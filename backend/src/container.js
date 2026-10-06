const { createTokenService } = require('./shared/security/token-service')
const { createPasswordHasher } = require('./shared/security/password-hasher')
const { createAuthenticate } = require('./shared/middleware/authenticate')
const { createAnalyticsRepository } = require('./modules/analytics/analytics.repository')
const { createAnalyticsService } = require('./modules/analytics/analytics.service')
const { createAnalyticsRouter } = require('./modules/analytics/analytics.routes')
const { createReportRepository } = require('./modules/analytics/conservation-report.repository')
const { createReportService } = require('./modules/analytics/conservation-report.service')
const { createReportRouter } = require('./modules/analytics/conservation-report.routes')

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
const { createPatrolRepository } = require('./modules/patrol/patrol.repository')
const { createCoverageService } = require('./modules/patrol/coverage.service')
const { createAllocationService } = require('./modules/patrol/allocation.service')
const { createEmergencyDispatchService } = require('./modules/patrol/emergency-dispatch.service')
const { createPatrolController } = require('./modules/patrol/patrol.controller')
const { createPatrolRouter } = require('./modules/patrol/patrol.routes')
const { createSmsGateway } = require('./modules/notifications/sms-gateway')
const { createNotificationDispatcher } = require('./modules/notifications/notification-dispatcher')
const { createConflictRepository } = require('./modules/conflicts/conflict.repository')
const { createConflictAccess } = require('./modules/conflicts/conflict-access')
const { createConflictNotifier } = require('./modules/conflicts/conflict-notifier')
const { createConflictWorkflow } = require('./modules/conflicts/conflict-workflow')
const { createConflictService } = require('./modules/conflicts/conflict.service')
const { createResponseService } = require('./modules/conflicts/response.service')
const { createConflictController } = require('./modules/conflicts/conflict.controller')
const { createConflictRouter, createResponseTaskRouter } = require('./modules/conflicts/conflict.routes')
const { createIncidentRepository } = require('./modules/incidents/incident.repository')
const { createIncidentService } = require('./modules/incidents/incident.service')
const { createIncidentController } = require('./modules/incidents/incident.controller')
const { createIncidentRouter } = require('./modules/incidents/incident.routes')

/** Loads the Mongoose models only when real repositories are needed. */
function loadModels() {
  return {
    User: require('./modules/users/user.model'),
    ConservationReport: require('./modules/analytics/conservation-report.model'),
    Park: require('./modules/parks/park.model'),
    Zone: require('./modules/parks/zone.model'),
    RangerTeam: require('./modules/teams/ranger-team.model'),
    Alert: require('./modules/alerts/alert.model'),
    Notification: require('./modules/notifications/notification.model'),
    PatrolRecord: require('./modules/patrol/patrol-record.model'),
    PatrolAssignment: require('./modules/patrol/patrol-assignment.model'),
    AllocationDecision: require('./modules/patrol/allocation-decision.model'),
    EmergencyDispatch: require('./modules/patrol/emergency-dispatch.model'),
    ConflictReport: require('./modules/conflicts/conflict-report.model'),
    ResponseTask: require('./modules/conflicts/response-task.model'),
    ResponseAction: require('./modules/conflicts/response-action.model'),
    WildlifeIncident: require('./modules/incidents/wildlife-incident.model'),
    IncidentPhoto: require('./modules/incidents/incident-photo.model')
  }
}

function createRepositories(models) {
  return {
    analyticsRepository: createAnalyticsRepository(models),
    reportRepository: createReportRepository(models.ConservationReport),
    userRepository: createUserRepository(models.User),
    parkRepository: createParkRepository(models),
    teamRepository: createTeamRepository(models.RangerTeam),
    alertRepository: createAlertRepository(models.Alert),
    notificationRepository: createNotificationRepository(models.Notification),
    patrolRepository: createPatrolRepository(models),
    conflictRepository: createConflictRepository(models),
    incidentRepository: createIncidentRepository(models)
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
  transactionRunner,
  passwordHasher = createPasswordHasher(),
  smsGateway = createSmsGateway({ mode: config.smsGatewayMode }),
  clock = () => new Date()
}) {
  const tokenService = createTokenService({ secret: config.jwtSecret, expiresIn: config.jwtExpiresIn })
  const authenticate = createAuthenticate({ tokenService })

  const services = {
    analyticsService: createAnalyticsService({ ...repositories, clock }),
    authService: createAuthService({ userRepository: repositories.userRepository, tokenService, passwordHasher }),
    teamService: createTeamService({ teamRepository: repositories.teamRepository }),
    alertService: createAlertService({ alertRepository: repositories.alertRepository, clock }),
    notificationService: createNotificationService({ notificationRepository: repositories.notificationRepository, clock })
  }
  services.reportService = createReportService({ ...repositories, clock, transactionRunner, notificationService: services.notificationService })

  // UC04 — Monitor Patrol Coverage and Allocate Resources (HETTIGE K.C.)
  const patrolDependencies = {
    transactionRunner,
    clock,
    parkRepository: repositories.parkRepository,
    teamRepository: repositories.teamRepository,
    patrolRepository: repositories.patrolRepository,
    teamService: services.teamService,
    alertService: services.alertService,
    notificationService: services.notificationService
  }
  services.coverageService = createCoverageService(patrolDependencies)
  services.allocationService = createAllocationService({ ...patrolDependencies, coverageService: services.coverageService })
  services.emergencyDispatchService = createEmergencyDispatchService({ ...patrolDependencies, coverageService: services.coverageService })

  // UC01 — Respond to Human–Elephant Conflict (WITTAHACHCHI D.K.G)
  services.notificationDispatcher = createNotificationDispatcher({ notificationService: services.notificationService, smsGateway })
  const conflictAccess = createConflictAccess({ userRepository: repositories.userRepository })
  const conflictDependencies = {
    transactionRunner,
    clock,
    access: conflictAccess,
    conflictRepository: repositories.conflictRepository,
    parkRepository: repositories.parkRepository,
    teamRepository: repositories.teamRepository,
    teamService: services.teamService,
    alertService: services.alertService,
    workflow: createConflictWorkflow({
      conflictRepository: repositories.conflictRepository,
      parkRepository: repositories.parkRepository,
      alertService: services.alertService,
      clock
    }),
    notifier: createConflictNotifier({
      userRepository: repositories.userRepository,
      notificationService: services.notificationService,
      notificationDispatcher: services.notificationDispatcher,
      conflictRepository: repositories.conflictRepository,
      clock
    })
  }
  services.conflictService = createConflictService(conflictDependencies)
  services.responseService = createResponseService(conflictDependencies)
  const conflictController = createConflictController({ ...services, conflictAccess })

  // UC03 — Report Wildlife and Poaching Incident (KALMADU H L G)
  services.incidentService = createIncidentService({
    transactionRunner,
    clock,
    incidentRepository: repositories.incidentRepository,
    parkRepository: repositories.parkRepository,
    alertService: services.alertService
  })
  const incidentController = createIncidentController(services)

  const routes = [
    { path: '/api/reports', router: createReportRouter({ reportService: services.reportService, authenticate }) },
    { path: '/api/analytics', router: createAnalyticsRouter({ analyticsService: services.analyticsService, authenticate }) },
    { path: '/api/auth', router: createAuthRouter({ authController: createAuthController(services), authenticate }) },
    { path: '/api/parks', router: createParkRouter({ parkRepository: repositories.parkRepository, authenticate }) },
    { path: '/api/teams', router: createTeamRouter({ teamService: services.teamService, authenticate }) },
    { path: '/api/alerts', router: createAlertRouter({ alertService: services.alertService, authenticate }) },
    {
      path: '/api/notifications',
      router: createNotificationRouter({ notificationService: services.notificationService, authenticate })
    },
    { path: '/api/patrol', router: createPatrolRouter({ patrolController: createPatrolController(services), authenticate }) },
    { path: '/api/conflicts', router: createConflictRouter({ conflictController, authenticate }) },
    { path: '/api/response-tasks', router: createResponseTaskRouter({ conflictController, authenticate }) },
    { path: '/api/incidents', router: createIncidentRouter({ incidentController, authenticate }) }
  ]

  return { repositories, services, routes, tokenService }
}

module.exports = { createContainer, createRepositories, loadModels }
