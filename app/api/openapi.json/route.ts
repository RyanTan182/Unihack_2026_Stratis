import { NextResponse } from "next/server"

const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "Supply Chain Crisis API",
    version: "1.0.0",
    description:
      "API for supply chain risk analysis, alternative sourcing recommendations, and news monitoring. Built for Unihack 2026.",
    contact: {
      name: "Stratis Team",
    },
  },
  servers: [
    {
      url: "/",
      description: "Current server",
    },
    {
      url: "http://localhost:3000",
      description: "Development server",
    },
  ],
  tags: [
    {
      name: "AI",
      description: "AI-powered supply chain analysis endpoints",
    },
    {
      name: "News",
      description: "News and monitoring endpoints",
    },
  ],
  paths: {
    "/api/ai/alternatives": {
      post: {
        tags: ["AI"],
        summary: "Suggest alternative sourcing countries",
        description:
          "Analyzes current supply chain sourcing and suggests 3-5 alternative countries with lower geopolitical risk, considering manufacturing capabilities, logistics, and cost competitiveness.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/AlternativesRequest",
              },
              examples: {
                example1: {
                  summary: "Electronics from China",
                  value: {
                    country: "China",
                    itemType: "electronics",
                    itemName: "Semiconductors",
                    currentRisk: 75,
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "List of alternative sourcing countries",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/AlternativesResponse",
                },
              },
            },
          },
          "400": {
            description: "Bad request - missing required fields",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "500": {
            description: "Server error - API key not configured",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "502": {
            description: "External API error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/api/ai/optimize": {
      post: {
        tags: ["AI"],
        summary: "Supply chain risk analysis",
        description:
          "Analyzes a product's supply chain tree for geopolitical, logistics, and trade risks. Provides risk summary, warnings for high-risk countries, and concrete optimization suggestions.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/OptimizeRequest",
              },
              examples: {
                example1: {
                  summary: "Smartphone supply chain",
                  value: {
                    product: {
                      name: "Smartphone X",
                      country: "Vietnam",
                      components: [
                        {
                          name: "Display",
                          type: "screen",
                          country: "South Korea",
                          children: [],
                        },
                        {
                          name: "Battery",
                          type: "power",
                          country: "China",
                          children: [],
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Risk analysis and optimization suggestions",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/OptimizeResponse",
                },
              },
            },
          },
          "400": {
            description: "Bad request - missing required fields",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "500": {
            description: "Server error - API key not configured",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "502": {
            description: "External API error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/api/gdelt": {
      get: {
        tags: ["News"],
        summary: "Fetch supply chain news articles",
        description:
          "Retrieves news articles from GDELT API related to a country's supply chain risks. Searches for articles about taxation, unrest, rebellion, and natural disasters.",
        parameters: [
          {
            name: "country",
            in: "query",
            required: true,
            description: "Country to search for news articles",
            schema: {
              type: "string",
            },
            example: "China",
          },
        ],
        responses: {
          "200": {
            description: "List of news articles",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/GdeltResponse",
                },
              },
            },
          },
          "400": {
            description: "Bad request - missing country parameter",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      AlternativesRequest: {
        type: "object",
        required: ["country"],
        properties: {
          country: {
            type: "string",
            description: "Current sourcing country",
            example: "China",
          },
          itemType: {
            type: "string",
            description: "Type of item (e.g., 'electronics', 'raw materials')",
            example: "electronics",
          },
          itemName: {
            type: "string",
            description: "Specific name of the item",
            example: "Semiconductors",
          },
          currentRisk: {
            type: "number",
            minimum: 0,
            maximum: 100,
            description: "Current risk score percentage",
            example: 75,
          },
        },
      },
      Alternative: {
        type: "object",
        required: ["country", "risk", "reason"],
        properties: {
          country: {
            type: "string",
            description: "Alternative country name",
            example: "Vietnam",
          },
          risk: {
            type: "string",
            enum: ["low", "medium", "high"],
            description: "Estimated risk level",
            example: "low",
          },
          reason: {
            type: "string",
            description: "One-sentence reason for recommendation",
            example: "Strong electronics manufacturing base with stable trade relations",
          },
        },
      },
      AlternativesResponse: {
        type: "object",
        required: ["alternatives"],
        properties: {
          alternatives: {
            type: "array",
            items: {
              $ref: "#/components/schemas/Alternative",
            },
            description: "List of alternative sourcing countries",
          },
          raw: {
            type: "string",
            description: "Raw AI response if JSON parsing failed",
          },
        },
      },
      Component: {
        type: "object",
        required: ["name", "type", "country"],
        properties: {
          name: {
            type: "string",
            description: "Component name",
            example: "Display",
          },
          type: {
            type: "string",
            description: "Component type",
            example: "screen",
          },
          country: {
            type: "string",
            description: "Sourcing country",
            example: "South Korea",
          },
          children: {
            type: "array",
            items: {},
            description: "Child components",
          },
        },
      },
      Product: {
        type: "object",
        required: ["name", "country", "components"],
        properties: {
          name: {
            type: "string",
            description: "Product name",
            example: "Smartphone X",
          },
          country: {
            type: "string",
            description: "Assembly country",
            example: "Vietnam",
          },
          components: {
            type: "array",
            items: {
              $ref: "#/components/schemas/Component",
            },
            description: "Supply chain components",
          },
        },
      },
      OptimizeRequest: {
        type: "object",
        required: ["product"],
        properties: {
          product: {
            $ref: "#/components/schemas/Product",
            description: "Product with supply chain tree",
          },
        },
      },
      OptimizeResponse: {
        type: "object",
        required: ["result"],
        properties: {
          result: {
            type: "string",
            description:
              "Risk analysis and optimization suggestions in markdown format",
          },
        },
      },
      Article: {
        type: "object",
        required: ["title", "url", "date", "source"],
        properties: {
          title: {
            type: "string",
            description: "Article title",
          },
          url: {
            type: "string",
            description: "Article URL",
          },
          date: {
            type: "string",
            description: "Publication date",
          },
          source: {
            type: "string",
            description: "News source domain",
          },
        },
      },
      GdeltResponse: {
        type: "object",
        required: ["articles"],
        properties: {
          articles: {
            type: "array",
            items: {
              $ref: "#/components/schemas/Article",
            },
            description: "List of news articles related to the country",
          },
        },
      },
      ErrorResponse: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "string",
            description: "Error message",
          },
          detail: {
            description: "Detailed error information",
          },
        },
      },
    },
  },
}

export async function GET() {
  return NextResponse.json(openApiSpec)
}
