import { printReport } from './report'

const core = require('@actions/core')
const { readdir, writeFile, mkdir, readFile } = require('fs/promises')
const { existsSync } = require('fs')
const { context, getOctokit } = require('@actions/github')
const parser = require('@evops/hcl-terraform-parser')

async function getPushDetails(githubToken, event) {
  if (!event.commits) return undefined

  const github = getOctokit(githubToken, context.repo)
  // push always originates from a PR
  const prs = await github.rest.pulls.list({
    ...context.repo,
    state: 'closed'
  })
  for (const commit of event.commits) {
    const found = prs.data.find(pr => pr.merge_commit_sha === commit.id)
    if (found)
      return {
        head: found.head.ref,
        actor: commit.author.username,
        actorName: commit.author.name
      }
  }
  core.info('Found no PRs related to the commits in the PushEvent')
}

async function getSourceFile(folder) {
  let filePaths = []
  // get contents for folder
  const paths = await readdir(folder, { withFileTypes: true })
  // check if item is a directory

  for (const path of paths) {
    const filePath = `${folder}/${path.name}`

    if (path.isDirectory()) {
      if (path.name.match(/.*node_modules.*|.git|.github/)) continue

      const recursePaths = await getSourceFile(`${folder}/${path.name}`)
      filePaths = filePaths.concat(recursePaths)
    } else {
      if (filePath.match(/.tf$/)) filePaths.push(filePath)
    }
  }
  return filePaths
}

async function calculateTerraformMetrics(file) {
  const content = await readFile(file)
  const hclFile = parser.parse(content)
  const keys = Object.keys(hclFile)
  const output = {}
  for (const key of keys) {
    const aspect = hclFile[key]
    const aspectLength = Object.keys(aspect).length
    output[key] = aspectLength
  }
  return output
}

export async function generateTerraformReport(
  event,
  githubToken,
  workingDirectory
) {
  const sourceFiles = await getSourceFile(workingDirectory)
  const analyzedFiles = await Promise.all(
    sourceFiles.map(async file => {
      try {
        return {
          file,
          report: await calculateTerraformMetrics(file)
        }
      } catch (e) {
        return {
          file,
          error:
            'failed to generate report for file, possible syntactical issue'
        }
      }
    })
  )
  const date = new Date().toISOString()

  const projectAnalytics = {
    managed_resources: 0,
    data_resources: 0,
    module_calls: 0
  }
  const summary = analyzedFiles.reduce((prev, cur) => {
    return {
      managed_resources:
        +prev.managed_resources + +cur.report.managed_resources,
      data_resources: +prev.data_resources + +cur.report.data_resources,
      module_calls: +prev.module_calls + +cur.report.module_calls
    }
  }, projectAnalytics)

  const baseMetrics = {
    sha: context.sha,
    ref: context.ref,
    repository: context.repo,
    files: analyzedFiles,
    summary,
    dateUtc: date
  }
  const prBase = {
    head: context.payload.pull_request?.head.ref,
    actor: context.actor
  }
  const pushBase = await getPushDetails(githubToken, event)
  // pull_request will be empty on a push
  const isPushRequest = !!pushBase
  const analytics = isPushRequest
    ? {
        ...pushBase,
        ...baseMetrics
      }
    : { ...prBase, ...baseMetrics }
  const folder = 'complexity-assessment'
  const filename = `${folder}/${context.sha}-infrastructure.json`
  await printReport(analytics)
  if (!existsSync(folder)) await mkdir(folder)
  await writeFile(filename, JSON.stringify(analytics, undefined, 2))
  return filename
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
async function run() {
  try {
    const workingDirectory = core.getInput('working_directory')
    const githubToken = core.getInput('github_token')
    const event = core.getInput('event')
    const filename = await generateTerraformReport(
      event,
      githubToken,
      workingDirectory || './terraform'
    )

    core.setOutput('export_filename', filename)
  } catch (error) {
    core.setFailed(error.message)
    core.setFailed(error.stack)
  }
}

run()
