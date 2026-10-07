require('dotenv').config({ quiet: true })
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const mongoose = require('mongoose')
const { loadConfig } = require('../config/env')
const { createTransactionRunner } = require('../config/database')

/** Operator-only, development-only correction of the exact user-approved proposal. */
async function main() {
  const config = loadConfig()
  if (config.isProduction) throw new Error('Report sample correction is development-only.')
  const proposal = fs.readFileSync(path.resolve(__dirname, '../../../docs/UC02-REPORT-CONTENT-PROPOSAL.md'), 'utf8')
  const samples = [...proposal.matchAll(/^## (.+) \(([a-f0-9]{24})\)\r?\n\r?\n\*\*Title:\*\* (.+)\r?\n\r?\n\*\*Findings\*\*\r?\n\r?\n([\s\S]+?)\r?\n\r?\n\*\*Recommendations\*\*\r?\n\r?\n([\s\S]+?)(?=\r?\n\r?\n## |(?![\s\S]))/gm)].map(match => ({
    oldTitle: match[1], id: match[2], title: match[3], findings: match[4].replace(/\r\n/g, '\n').trim(), recommendations: match[5].replace(/\r\n/g, '\n').trim(),
  }))
  assert.equal(samples.length, 11)
  assert.equal(new Set(samples.map(sample => sample.id)).size, 11)
  await mongoose.connect(config.mongoUri, { dbName: config.mongoDbName })
  const { loadModels } = require('../container')
  const models = loadModels()
  const before = await models.ConservationReport.find().select('+contentHash +supersededRequestIds').lean()
  const runner = createTransactionRunner()
  let updated = 0
  await runner.run(async session => {
    updated = 0
    for (const sample of samples) {
      const original = before.find(report => String(report._id) === sample.id)
      assert(original, `Missing approved report ${sample.id}`)
      const fields = { title: sample.title, findings: sample.findings, recommendations: sample.recommendations }
      const { sampleReportContent } = require('./report-content')
      assert.deepEqual(fields, sampleReportContent(original.snapshot), `Proposal differs from snapshot for ${sample.id}`)
      if (Object.entries(fields).every(([field, value]) => original[field] === value)) continue
      assert.equal(original.title, sample.oldTitle, `Report ${sample.id} changed since approval`)
      const result = await models.ConservationReport.updateOne({ _id: sample.id, title: original.title,
        findings: original.findings, recommendations: original.recommendations }, { $set: fields },
      { session, timestamps: false, runValidators: true })
      assert.equal(result.modifiedCount, 1)
      updated++
    }
  })
  const after = await models.ConservationReport.find().select('+contentHash +supersededRequestIds').lean()
  assert.equal(after.length, before.length)
  for (const original of before) {
    const actual = after.find(report => String(report._id) === String(original._id))
    const sample = samples.find(item => item.id === String(original._id))
    assert.deepEqual(actual, sample ? { ...original, title: sample.title, findings: sample.findings, recommendations: sample.recommendations } : original)
  }
  console.log(JSON.stringify({ updated, verified: samples.length, otherReportsUnchanged: before.length - samples.length,
    reports: samples.map(({ id, oldTitle, title }) => ({ id, oldTitle, title })) }, null, 2))
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => mongoose.disconnect())
