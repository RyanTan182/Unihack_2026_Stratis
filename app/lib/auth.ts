const AUTH_KEY = "stratis-auth"

export const MOCK_CREDENTIALS = {
  username: "stratis",
  password: "supplychain",
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false
  return sessionStorage.getItem(AUTH_KEY) === "true"
}

export function setAuthenticated(value: boolean): void {
  if (typeof window === "undefined") return
  if (value) {
    sessionStorage.setItem(AUTH_KEY, "true")
  } else {
    sessionStorage.removeItem(AUTH_KEY)
  }
}

export function validateCredentials(username: string, password: string): boolean {
  return (
    username === MOCK_CREDENTIALS.username &&
    password === MOCK_CREDENTIALS.password
  )
}
