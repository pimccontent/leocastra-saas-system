import axios from "axios"
import { getAuthToken } from "./auth"

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001/api"

export const api = axios.create({
  baseURL,
})

api.interceptors.request.use((config) => {
  const token = getAuthToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("leocastra_saas_token")
        if (!window.location.pathname.startsWith("/login")) {
          window.location.assign("/login")
        }
      }
    }
    return Promise.reject(error)
  },
)
