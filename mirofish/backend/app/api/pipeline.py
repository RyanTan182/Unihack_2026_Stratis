"""
Pipeline API - Runs the full MiroFish pipeline asynchronously in a background thread.

POST /api/pipeline/start  — kick off ontology → graph → simulation pipeline
GET  /api/pipeline/<id>/status — poll for progress
"""

import uuid
import threading
import traceback

from flask import request, jsonify

from . import pipeline_bp
from ..utils.logger import get_logger

logger = get_logger('mirofish.pipeline')

# In-memory pipeline state — persists on Railway (long-lived process)
_pipelines: dict[str, dict] = {}


def _run_pipeline(pipeline_id: str, seed_markdown: str, simulation_requirement: str, metadata: dict):
    """Background thread: runs the full pipeline end-to-end."""
    from ..services.ontology_generator import OntologyGenerator
    from ..services.graph_builder import GraphBuilderService
    from ..services.text_processor import TextProcessor
    from ..services.simulation_manager import SimulationManager
    from ..services.simulation_runner import SimulationRunner
    from ..models.project import ProjectManager, ProjectStatus

    state = _pipelines[pipeline_id]

    try:
        # --- Step 1: Ontology generation ---
        state['status'] = 'ontology'
        logger.info(f"[{pipeline_id}] Generating ontology...")

        generator = OntologyGenerator()
        ontology = generator.generate(
            document_texts=[seed_markdown],
            simulation_requirement=simulation_requirement,
        )

        if not ontology or not ontology.get('entity_types'):
            raise RuntimeError("Ontology generation returned empty result")

        # Create project and save text + ontology (mirroring graph.py ontology/generate)
        project = ProjectManager.create_project(
            name=metadata.get('scenario', 'Pipeline project')[:80],
        )
        project.simulation_requirement = simulation_requirement
        project.total_text_length = len(seed_markdown)
        project.files = [{'filename': 'seed.md', 'size': len(seed_markdown)}]
        project.ontology = {
            'entity_types': ontology.get('entity_types', []),
            'edge_types': ontology.get('edge_types', []),
        }
        project.analysis_summary = ontology.get('analysis_summary', '')
        project.status = ProjectStatus.ONTOLOGY_GENERATED
        ProjectManager.save_project(project)
        ProjectManager.save_extracted_text(project.project_id, seed_markdown)

        project_id = project.project_id
        state['project_id'] = project_id
        logger.info(f"[{pipeline_id}] Ontology done, project_id={project_id}")

        # --- Step 2: Graph building ---
        state['status'] = 'graph'
        logger.info(f"[{pipeline_id}] Building graph...")

        graph_service = GraphBuilderService()
        graph_name = f"pipeline-{pipeline_id[:8]}"
        graph_id = graph_service.create_graph(graph_name)

        # Set ontology on graph
        graph_service.set_ontology(graph_id, project.ontology)

        # Chunk text and add
        chunks = TextProcessor.split_text(seed_markdown, chunk_size=500, chunk_overlap=50)
        episode_uuids = graph_service.add_text_batches(graph_id, chunks)

        # Wait for Zep to finish processing
        if episode_uuids:
            graph_service._wait_for_episodes(episode_uuids)

        # Save graph_id to project
        project.graph_id = graph_id
        project.status = ProjectStatus.GRAPH_COMPLETED
        ProjectManager.save_project(project)
        logger.info(f"[{pipeline_id}] Graph built, graph_id={graph_id}")

        # --- Step 3: Create simulation ---
        state['status'] = 'creating'
        logger.info(f"[{pipeline_id}] Creating simulation...")

        sim_manager = SimulationManager()
        sim_state = sim_manager.create_simulation(project_id=project_id, graph_id=graph_id)
        simulation_id = sim_state.simulation_id
        state['simulation_id'] = simulation_id
        logger.info(f"[{pipeline_id}] Simulation created, id={simulation_id}")

        # --- Step 4: Prepare simulation ---
        state['status'] = 'preparing'
        logger.info(f"[{pipeline_id}] Preparing simulation...")

        sim_manager.prepare_simulation(
            simulation_id=simulation_id,
            simulation_requirement=simulation_requirement,
            document_text=seed_markdown,
        )
        logger.info(f"[{pipeline_id}] Simulation prepared")

        # --- Step 5: Run simulation ---
        state['status'] = 'running'
        logger.info(f"[{pipeline_id}] Starting simulation run...")

        SimulationRunner.start_simulation(
            simulation_id=simulation_id,
            platform='parallel',
            max_rounds=10,
            enable_graph_memory_update=True,
            graph_id=graph_id,
        )

        state['status'] = 'completed'
        logger.info(f"[{pipeline_id}] Pipeline completed (simulation now running)")

    except Exception as e:
        state['status'] = 'failed'
        state['error'] = str(e)
        logger.error(f"[{pipeline_id}] Pipeline failed: {e}")
        logger.error(traceback.format_exc())


@pipeline_bp.route('/start', methods=['POST'])
def start_pipeline():
    """Start the full pipeline asynchronously. Returns immediately with a pipeline_id."""
    data = request.get_json()
    if not data:
        return jsonify(success=False, error="JSON body required"), 400

    seed_markdown = data.get('seed_markdown', '')
    simulation_requirement = data.get('simulation_requirement', '')
    metadata = data.get('metadata', {})

    if not seed_markdown:
        return jsonify(success=False, error="seed_markdown is required"), 400
    if not simulation_requirement:
        return jsonify(success=False, error="simulation_requirement is required"), 400

    pipeline_id = str(uuid.uuid4())
    _pipelines[pipeline_id] = {
        'status': 'started',
        'simulation_id': None,
        'project_id': None,
        'metadata': metadata,
        'error': None,
    }

    thread = threading.Thread(
        target=_run_pipeline,
        args=(pipeline_id, seed_markdown, simulation_requirement, metadata),
        daemon=True,
    )
    thread.start()

    return jsonify(success=True, data={
        'pipeline_id': pipeline_id,
        'status': 'started',
    })


@pipeline_bp.route('/<pipeline_id>/status', methods=['GET'])
def get_pipeline_status(pipeline_id: str):
    """Poll pipeline progress."""
    state = _pipelines.get(pipeline_id)
    if not state:
        return jsonify(success=False, error="Pipeline not found"), 404

    return jsonify(success=True, data={
        'pipeline_id': pipeline_id,
        'status': state['status'],
        'simulation_id': state.get('simulation_id'),
        'project_id': state.get('project_id'),
        'metadata': state.get('metadata', {}),
        'error': state.get('error'),
    })
