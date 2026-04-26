import { useQuery } from "@tanstack/react-query"
import { api } from "./api"

export type Me = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  platformRole: "OWNER" | "ADMIN"
  organizationRole: "OWNER" | "ADMIN" | "MEMBER" | null
  organizationId: string | null
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const response = await api.get<Me>("/auth/me")
      return response.data
    },
  })
}
