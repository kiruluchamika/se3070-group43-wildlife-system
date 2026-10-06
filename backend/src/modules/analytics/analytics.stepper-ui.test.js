let React, renderToStaticMarkup, WorkflowStepper
beforeAll(async () => {
  React = await import('../../../../frontend/node_modules/react/index.js')
  vi.stubGlobal('React', React)
  ;({ renderToStaticMarkup } = await import('../../../../frontend/node_modules/react-dom/server.node.js'))
  ;({ WorkflowStepper } = await import('../../../../frontend/src/features/analytics/components/WorkflowStepper.jsx'))
})
afterAll(() => vi.unstubAllGlobals())

it.each(['filters', 'results', 'findings', 'preparation', 'preview', 'saved'])('shows accessible visual progress for %s without navigation', (current) => {
  const stages = ['filters', 'results', 'findings', 'preparation', 'preview', 'saved']
  const active = stages.indexOf(current)
  const html = renderToStaticMarkup(React.createElement(WorkflowStepper, { current }))
  expect(html.match(/<li[ >]/g)).toHaveLength(6)
  expect(html.match(/aria-current="step"/g)).toHaveLength(1)
  expect(html.match(/, completed/g) ?? []).toHaveLength(active)
  expect(html.match(/, upcoming/g) ?? []).toHaveLength(5 - active)
  for (const label of ['Filters', 'Analysis Results', 'Findings &amp; Recommendations', 'Report Preparation', 'Preview', 'Saved Report']) expect(html).toContain(label)
  expect(html).not.toMatch(/<(button|a)\b|tabindex=/i)
  expect(html).toContain('Analysis report progress')
})

it('does not show workflow progress for unrelated stages', () => {
  expect(renderToStaticMarkup(React.createElement(WorkflowStepper, { current: 'dashboard' }))).toBe('')
})
