/** HTTP adapter for account actions; business rules live in the auth service. */
function createAuthController({ authService }) {
  return {
    async register(request, response) {
      const session = await authService.register(request.validated.body)
      response.status(201).json(session)
    },

    async login(request, response) {
      const session = await authService.login(request.validated.body)
      response.json(session)
    },

    async me(request, response) {
      const user = await authService.getProfile(request.user.id)
      response.json({ user })
    }
  }
}

module.exports = { createAuthController }
