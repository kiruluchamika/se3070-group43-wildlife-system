import { Map as MapIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Card } from '../../../components/ui/Card'
import { ErrorState } from '../../../components/ui/Feedback'
import { PageHeader } from '../../../components/ui/PageHeader'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { useNow } from '../../../hooks/useNow'
import { stagger } from '../../../lib/motion'
import { patrolApi, patrolPaths } from '../api/patrolApi'
import { ActiveAlertsPanel } from '../components/ActiveAlertsPanel'
import { AllocationPanel } from '../components/AllocationPanel'
import { AssignmentConfirmDialog, SuccessDialog } from '../components/AssignmentDialogs'
import { CoverageMap } from '../components/CoverageMap'
import { CoverageSummary } from '../components/CoverageSummary'
import { EmergencyDispatchDialog } from '../components/EmergencyDispatchDialog'
import { PatrolToolbar } from '../components/PatrolToolbar'
import { RangerTeamsPanel } from '../components/RangerTeamsPanel'
import { UnderPatrolledZonesTable } from '../components/UnderPatrolledZonesTable'
import { useSelectedPark } from '../hooks/useSelectedPark'

const REFRESH_MS = 30000

/**
 * UC04 Central Operations Dashboard — "Patrol Coverage & Resource Allocation"
 * (Group 41 hi-fi wireframe, p. 50). Coverage, alerts and teams refresh every
 * 30 seconds; a failure in one panel never hides the others.
 */
export default function PatrolDashboardPage() {
  const now = useNow()
  const { parks, parkId, selectPark, error: parksError, reload: reloadParks } = useSelectedPark()

  const [selectedZoneId, setSelectedZoneId] = useState(null)
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [notes, setNotes] = useState('')
  const [reason, setReason] = useState('')
  const [focus, setFocus] = useState(null)
  const [confirmRequest, setConfirmRequest] = useState(null)
  const [success, setSuccess] = useState(null)
  const [dispatchAlert, setDispatchAlert] = useState(null)

  const coverage = useApiQuery(parkId ? patrolPaths.coverage(parkId) : null, { refreshMs: REFRESH_MS })
  const alerts = useApiQuery(parkId ? patrolPaths.alerts(parkId) : null, { refreshMs: REFRESH_MS })
  const zones = coverage.data?.zones ?? []
  // Default to the highest-priority under-patrolled zone until the manager picks one.
  const zoneId = selectedZoneId ?? zones.find((assessment) => assessment.status === 'under-patrolled')?.zone.id ?? null
  const teams = useApiQuery(parkId ? patrolPaths.teams(parkId, zoneId ?? undefined) : null, { refreshMs: REFRESH_MS })

  const teamList = teams.data?.teams ?? []
  const alertList = alerts.data?.alerts ?? []

  function refreshAll() {
    coverage.reload()
    alerts.reload()
    teams.reload()
  }

  function changePark(nextParkId) {
    selectPark(nextParkId)
    setSelectedZoneId(null)
    setSelectedTeamId(null)
    setFocus(null)
  }

  function selectZone(nextZoneId) {
    setSelectedZoneId(nextZoneId)
    const assessment = zones.find((entry) => entry.zone.id === nextZoneId)
    if (assessment?.zone.centroid) setFocus({ ...assessment.zone.centroid, key: nextZoneId })
  }

  function viewAlert(alert) {
    if (alert.zone?.id) setSelectedZoneId(alert.zone.id)
    if (alert.location) setFocus({ ...alert.location, key: alert.id })
  }

  async function acknowledgeAlert(alert) {
    try {
      await patrolApi.acknowledgeAlert(alert.id)
      toast.success(`${alert.title} acknowledged`)
      alerts.reload()
    } catch (error) {
      toast.error(error.message)
    }
  }

  function requestConfirmation({ mode, team, impact }) {
    const zone = zones.find((entry) => entry.zone.id === zoneId)
    setConfirmRequest({ id: `${zoneId}:${team.id}:${Date.now()}`, mode, zone, team, impact, notes: notes.trim(), reason: reason.trim() })
  }

  function handleSaved(result) {
    setConfirmRequest(null)
    setSuccess({
      title: 'Patrol Assignment Updated',
      message:
        result.mode === 'reassign'
          ? `${result.team.name} has been reassigned to ${result.zone.name}.${result.vacatedZone?.name ? ` ${result.vacatedZone.name} no longer has this team.` : ''}`
          : `${result.team.name} has been assigned to ${result.zone.name}.`,
    })
    setSelectedTeamId(null)
    setNotes('')
    setReason('')
    refreshAll()
  }

  if (parksError) {
    return <ErrorState title="Patrol data unavailable" message={parksError.message} onRetry={reloadParks} />
  }

  return (
    <>
      <PageHeader
        eyebrow="UC04 · Park Manager"
        title="Patrol Coverage & Resource Allocation"
        description="Monitor patrol activities, identify critical areas and allocate ranger teams."
        actions={
          <PatrolToolbar
            parks={parks}
            parkId={parkId}
            onParkChange={changePark}
            updatedAt={coverage.updatedAt}
            refreshing={coverage.refreshing || alerts.refreshing}
            onRefresh={refreshAll}
            now={now}
          />
        }
      />

      <CoverageSummary summary={coverage.data?.summary} loading={coverage.loading} />

      <motion.div variants={stagger} initial="hidden" animate="visible" className="mt-6 grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        <Card title="Patrol Coverage Map" icon={MapIcon} bodyClassName="p-3">
          {coverage.error ? (
            <ErrorState
              title="Patrol data unavailable"
              message={`${coverage.error.message} Resource allocation decisions cannot be made until patrol data loads.`}
              onRetry={coverage.reload}
              className="h-[420px]"
            />
          ) : (
            <CoverageMap
              className="h-[340px] sm:h-[420px]"
              parkId={parkId}
              zones={zones}
              teams={coverage.data?.teams ?? []}
              alerts={alertList}
              routes={coverage.data?.routes ?? []}
              selectedZoneId={zoneId}
              selectedTeamId={selectedTeamId}
              onSelectZone={selectZone}
              focus={focus}
              now={now}
            />
          )}
        </Card>

        <ActiveAlertsPanel
          className="xl:max-h-[498px]"
          alerts={alertList}
          loading={alerts.loading}
          error={alerts.error}
          onRetry={alerts.reload}
          now={now}
          onView={viewAlert}
          onDispatch={setDispatchAlert}
          onAcknowledge={acknowledgeAlert}
        />

        <UnderPatrolledZonesTable
          zones={zones}
          loading={coverage.loading}
          error={coverage.error}
          onRetry={coverage.reload}
          selectedZoneId={zoneId}
          onSelectZone={selectZone}
        />

        <RangerTeamsPanel
          teams={teamList}
          loading={teams.loading}
          error={teams.error}
          onRetry={teams.reload}
          selectedTeamId={selectedTeamId}
          onSelectTeam={setSelectedTeamId}
          zoneSelected={Boolean(zoneId)}
        />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-6">
        <AllocationPanel
          zones={zones}
          teams={teamList}
          selectedZoneId={zoneId}
          selectedTeamId={selectedTeamId}
          onZoneChange={(nextZoneId) => (nextZoneId ? selectZone(nextZoneId) : setSelectedZoneId(null))}
          onTeamChange={setSelectedTeamId}
          notes={notes}
          onNotesChange={setNotes}
          reason={reason}
          onReasonChange={setReason}
          onConfirm={requestConfirmation}
          disabled={Boolean(coverage.error) || coverage.loading}
        />
      </motion.div>

      <AssignmentConfirmDialog key={confirmRequest?.id} request={confirmRequest} onClose={() => setConfirmRequest(null)} onSaved={handleSaved} />
      <SuccessDialog result={success} onClose={() => setSuccess(null)} />
      <EmergencyDispatchDialog
        key={dispatchAlert?.id}
        alert={dispatchAlert}
        onClose={() => setDispatchAlert(null)}
        onDispatched={(result) => {
          toast.success(`${result.team.name} dispatched to ${result.alert.title}`)
          refreshAll()
        }}
      />
    </>
  )
}
