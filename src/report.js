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
    [report.actor, report.sha, report.ref]
  ])

  summary.addTable([
    [
      { data: 'Managed Resources', header: true },
      { data: 'Data Resources', header: true },
      { data: 'Module Calls', header: true }
    ],
    [
      summary.managed_resources.toString(),
      summary.data_resources.toString(),
      summary.module_calls.toString()
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
        file.managed_resources.toString(),
        file.data_resources.toString(),
        file.module_calls.toString()
      ]
    ])
  }

  await summary.write()
}

module.exports = { printReport }
