let React, renderToStaticMarkup, WorkflowStepper
beforeAll(async () => {
  React = await import('../../../../frontend/node_modules/react/index.js')
  vi.stubGlobal('React', React)
  ;({ renderToStaticMarkup } = await import('../../../../frontend/node_modules/react-dom/server.node.js'))
  ;({ WorkflowStepper } = await import('../../../../frontend/src/features/analytics/components/WorkflowStepper.jsx'))
})
afterAll(() => vi.unstubAllGlobals())

it.each(['filters', 'results', 'findings', 'preparation', 'preview'])('shows accessible visual progress for %s without navigation', (current) => {
  const stages = ['filters', 'results', 'findings', 'preparation', 'preview']
  const active = stages.indexOf(current)
  const html = renderToStaticMarkup(React.createElement(WorkflowStepper, { current }))
  expect(html.match(/<li[ >]/g)).toHaveLength(5)
  expect(html.match(/aria-current="step"/g)).toHaveLength(1)
  expect(html.match(/, completed/g) ?? []).toHaveLength(active)
  expect(html.match(/, upcoming/g) ?? []).toHaveLength(4 - active)
  for (const label of ['Analysis', 'Results', 'Findings &amp; Recommendations', 'Preparation', 'Preview']) expect(html).toContain(label)
  expect(html).not.toMatch(/<(button|a)\b|tabindex=/i)
  expect(html).toContain('Analysis report progress')
  expect(html).not.toContain('Saved Report')
})

it.each(['dashboard', 'saved'])('does not show creation progress for %s', (current) => {
  expect(renderToStaticMarkup(React.createElement(WorkflowStepper, { current }))).toBe('')
})
