const { loadConfig, parseList } = require('./env')

describe('parseList', () => {
  it('splits comma-separated values and drops blanks', () => {
    expect(parseList(' http://a.test , ,http://b.test ')).toEqual(['http://a.test', 'http://b.test'])
  })

  it('returns an empty list for missing values', () => {
    expect(parseList(undefined)).toEqual([])
  })
})

describe('loadConfig', () => {
  it('applies development defaults when variables are missing', () => {
    const config = loadConfig({})

    expect(config).toMatchObject({
      nodeEnv: 'development',
      isProduction: false,
      port: 5000,
      clientOrigins: ['http://localhost:5173'],
      mongoDbName: 'wildguard',
      jwtExpiresIn: '8h',
      serveFrontend: false
    })
    expect(config.frontendDist).toMatch(/frontend[\\/]dist$/)
  })

  it('reads explicit values, including several allowed client origins', () => {
    const config = loadConfig({
      PORT: '7000',
      CLIENT_URL: 'http://localhost:5173,https://wildguard.example.com',
      MONGODB_DB_NAME: 'wildguard_kirulu',
      JWT_SECRET: 'secret',
      SERVE_FRONTEND: 'true'
    })

    expect(config.port).toBe(7000)
    expect(config.clientOrigins).toEqual(['http://localhost:5173', 'https://wildguard.example.com'])
    expect(config.mongoDbName).toBe('wildguard_kirulu')
    expect(config.serveFrontend).toBe(true)
  })

  it('refuses to start in production without a JWT secret', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow('JWT_SECRET must be configured in production.')
  })

  it('returns an immutable object', () => {
    expect(Object.isFrozen(loadConfig({}))).toBe(true)
  })
})
