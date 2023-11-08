const core = require('@actions/core')
const { readdir, writeFile, mkdir, readFile } = require('fs/promises')
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

async function getSourceFile(folder, includedType, excludedType) {
  let filePaths = []
  // get contents for folder
  const paths = await readdir(folder, { withFileTypes: true })
  // check if item is a directory

  for (const path of paths) {
    const filePath = `${folder}/${path.name}`

    if (path.isDirectory()) {
      if (path.name.match(/.*node_modules.*|.git|.github/)) continue

      const recursePaths = await getSourceFile(
        `${folder}/${path.name}`,
        includedType,
        excludedType
      )
      filePaths = filePaths.concat(recursePaths)
    } else {
      if (filePath.match(includedType) && !filePath.match(excludedType))
        filePaths.push(filePath)
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
  core.info(hclFile)
  return output
}

export async function generateTerraformReport(
  event,
  githubToken,
  workingDirectory
) {
  const inc = core.getInput('includedFileTypes')
  const exc = core.getInput('excludedFileTypes')
  const include = new RegExp(inc)
  const exclude = new RegExp(exc)
  const sourceFiles = await getSourceFile(workingDirectory, include, exclude)
  const analyzedFiles = (
    await Promise.all(
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
  )
    .filter(file => !!file.report)
    .filter(file => Object.keys(file.report).length > 0)
  const date = new Date().toISOString()

  const baseMetrics = {
    sha: context.sha,
    ref: context.ref,
    repository: context.repo,
    files: analyzedFiles,
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
  const filename = `${folder}/${context.sha}.json`
  await mkdir(folder)
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
      workingDirectory || './terrarform'
    )

    core.setOutput('export_filename', filename)
  } catch (error) {
    core.setFailed(error.message)
    core.setFailed(error.stack)
  }
}

run()
