const React = require('../../../frontend/node_modules/react')
// Import before installing the small host double: this test root never renders
// host children. React's actual reconciler, hooks, effects and cleanup still run.
const { createRoot } = require('../../../frontend/node_modules/react-dom/client')

/** A null-output React root, not a browser/DOM integration test. */
function installHeadlessHost() {
  const document = {
    nodeType: 9, activeElement: null,
    addEventListener() {}, removeEventListener() {},
    documentElement: { namespaceURI: 'http://www.w3.org/1999/xhtml' },
  }
  const window = { document, HTMLIFrameElement: class {} }
  document.defaultView = window
  vi.stubGlobal('document', document)
  vi.stubGlobal('window', window)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('React', React)
  return () => ({
    nodeType: 1, nodeName: 'DIV', tagName: 'DIV', ownerDocument: document,
    namespaceURI: 'http://www.w3.org/1999/xhtml',
    addEventListener() {}, removeEventListener() {}, textContent: '',
  })
}

async function mountProbe(probe, makeContainer) {
  const root = createRoot(makeContainer())
  let current, mounted = true, renders = 0
  function Probe() {
    renders++
    current = probe()
    return null
  }
  await React.act(async () => { root.render(React.createElement(Probe)) })
  return {
    get current() { return current },
    get renders() { return renders },
    async rerender() {
      await React.act(async () => { root.render(React.createElement(Probe)) })
    },
    async unmount() {
      if (!mounted) return
      await React.act(async () => { root.unmount() })
      mounted = false
    },
  }
}

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

module.exports = { React, installHeadlessHost, mountProbe, deferred }
