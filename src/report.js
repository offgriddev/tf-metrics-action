const core = require('@actions/core')

async function printReport(report) {
  const summary = core.summary.addHeading('Summary')
  summary.addTable([
    [
      {
        data: 'Actor',
        header: true
      },
      {
        data: 'SHA',
        header: true
      },
      {
        data: 'Branch',
        header: true
      }
    ],
    [report.actor, report.sha, report.head]
  ])

  summary.addTable([
    [
      { data: 'Managed Resources', header: true },
      { data: 'Data Resources', header: true },
      { data: 'Module Calls', header: true }
    ],
    [
      report.summary.managed_resources.toString(),
      report.summary.data_resources.toString(),
      report.summary.module_calls.toString()
    ]
  ])
  summary.addHeading('Complexity Report', 2)
  for (const file of report.files) {
    summary.addHeading(`File: ${file.file}\n`, 3)

    summary.addTable([
      [
        { data: 'Managed Resources', header: true },
        { data: 'Data Resources', header: true },
        { data: 'Module Calls', header: true }
      ],
      [
        file.report.managed_resources.toString(),
        file.report.data_resources.toString(),
        file.report.module_calls.toString()
      ]
    ])
  }

  await summary.write()
}

module.exports = { printReport }
