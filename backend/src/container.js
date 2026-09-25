const { createTokenService } = require('./shared/security/token-service')
const { createPasswordHasher } = require('./shared/security/password-hasher')
const { createAuthenticate } = require('./shared/middleware/authenticate')

const { createUserRepository } = require('./modules/users/user.repository')
const { createAuthService } = require('./modules/users/auth.service')
const { createAuthController } = require('./modules/users/auth.controller')
const { createAuthRouter } = require('./modules/users/auth.routes')
const { createParkRepository } = require('./modules/parks/park.repository')
const { createParkRouter } = require('./modules/parks/park.routes')
const { createTeamRepository } = require('./modules/teams/team.repository')
const { createTeamService } = require('./modules/teams/team.service')
const { createTeamRouter } = require('./modules/teams/team.routes')
const { createAlertRepository } = require('./modules/alerts/alert.repository')
const { createAlertService } = require('./modules/alerts/alert.service')
const { createAlertRouter } = require('./modules/alerts/alert.routes')
const { createNotificationRepository } = require('./modules/notifications/notification.repository')
const { createNotificationService } = require('./modules/notifications/notification.service')
const { createNotificationRouter } = require('./modules/notifications/notification.routes')

/** Loads the Mongoose models only when real repositories are needed. */
function loadModels() {
  return {
    User: require('./modules/users/user.model'),
    Park: require('./modules/parks/park.model'),
    Zone: require('./modules/parks/zone.model'),
    RangerTeam: require('./modules/teams/ranger-team.model'),
    Alert: require('./modules/alerts/alert.model'),
    Notification: require('./modules/notifications/notification.model')
  }
}

function createRepositories(models) {
  return {
    userRepository: createUserRepository(models.User),
    parkRepository: createParkRepository(models),
    teamRepository: createTeamRepository(models.RangerTeam),
    alertRepository: createAlertRepository(models.Alert),
    notificationRepository: createNotificationRepository(models.Notification)
  }
}

/**
 * Composition root: the only place that knows how repositories, services and
 * routers are wired together. Tests pass in-memory repositories instead.
 *
 * Team members register their module here (UC01 conflicts, UC02 analytics,
 * UC03 incidents) by adding its repositories, services and router.
 */
function createContainer({
  config,
  repositories = createRepositories(loadModels()),
  passwordHasher = createPasswordHasher(),
  clock = () => new Date()
}) {
  const tokenService = createTokenService({ secret: config.jwtSecret, expiresIn: config.jwtExpiresIn })
  const authenticate = createAuthenticate({ tokenService })

  const services = {
    authService: createAuthService({ userRepository: repositories.userRepository, tokenService, passwordHasher }),
    teamService: createTeamService({ teamRepository: repositories.teamRepository }),
    alertService: createAlertService({ alertRepository: repositories.alertRepository, clock }),
    notificationService: createNotificationService({ notificationRepository: repositories.notificationRepository, clock })
  }

  const routes = [
    { path: '/api/auth', router: createAuthRouter({ authController: createAuthController(services), authenticate }) },
    { path: '/api/parks', router: createParkRouter({ parkRepository: repositories.parkRepository, authenticate }) },
    { path: '/api/teams', router: createTeamRouter({ teamService: services.teamService, authenticate }) },
    { path: '/api/alerts', router: createAlertRouter({ alertService: services.alertService, authenticate }) },
    {
      path: '/api/notifications',
      router: createNotificationRouter({ notificationService: services.notificationService, authenticate })
    }
  ]

  return { repositories, services, routes, tokenService }
}

module.exports = { createContainer, createRepositories, loadModels }
