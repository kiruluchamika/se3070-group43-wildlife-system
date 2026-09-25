/** Actor roles from Group 41's use case diagram. */
const ROLES = Object.freeze({
  VILLAGER: 'villager',
  RANGER: 'ranger',
  LIAISON_OFFICER: 'liaison-officer',
  PARK_MANAGER: 'park-manager',
  DATA_ANALYST: 'data-analyst'
})

const ALL_ROLES = Object.freeze(Object.values(ROLES))

module.exports = { ROLES, ALL_ROLES }
