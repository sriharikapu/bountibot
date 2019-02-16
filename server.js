// This file doesn't go through babel or webpack transformation.
// Make sure the syntax and sources this file requires are compatible with the current node version you are running
// See https://github.com/zeit/next.js/issues/1245 for discussions on Universal Webpack or universal Babel
const express = require('express')
const { parse } = require('url')
const next = require('next')
const bodyParser = require('body-parser')
const Octokit = require('@octokit/rest')
const fb = require('./server/firebase')

const dev = process.env.NODE_ENV !== 'production'
const port = process.env.PORT || 3000
const app = next({ dev })
const handle = app.getRequestHandler()

const addressRegex = new RegExp(/\[bounty: (0x[a-f0-9]+)\]/, 'i')

const createNoAddressComment = async (octokit, body) => {
  const result = await octokit.issues.createComment({
    owner: body.repository.owner.login,
    repo: body.repository.name,
    number: body.pull_request.number,
    body: `Yaaaargh, I see you've made a PR on ${body.repository.name}. We are offering rewards of 100 LINK to all PRs that get merged to this repository. To claim your LINK, place an EIP155 Address in your PR's description, like so: [bounty: 0x356a04bce728ba4c62a30294a55e6a8600a320b3].`
  }).catch(console.error)
}

const createRewardableComment = async (octokit, body, address) => {
  const result = await octokit.issues.createComment({
    owner: body.repository.owner.login,
    repo: body.repository.name,
    number: body.pull_request.number,
    body: `100 LINK has been rewarded to ${address}`
  }).catch(console.error)
}

const openedIssue = async (octokit, body) => {
  console.log('posting comment on issue', body.pull_request.number)

  const match = body.pull_request.body.match(addressRegex)
  if (match) {
    createRewardableComment(octokit, body, match[1])
  } else {
    createNoAddressComment(octokit, body)
  }
}

const editedIssue = async (octokit, body) => {
  const match = body.pull_request.body.match(addressRegex)
  if (match) {
    createRewardableComment(octokit, body, match[1])
  }
}

app.prepare().then(() => {
  const server = express()
  const octokit = new Octokit({
    auth: `token ${process.env.GITHUB_KEY}`
  })

  server.use(bodyParser.json())

  server.post('/gh_webhooks', (req, _res) => {
    console.log('got webhook action', req.body.action)
    console.log('body', req.body)

    if (req.body.action === 'opened') {
      openedIssue(octokit, req.body)
    } else if (req.body.action === 'edited') {
      editedIssue(octokit, req.body)
    }
  })

  server
    .get('*', (req, res) => {
      const parsedUrl = parse(req.url, true)
      handle(req, res, parsedUrl)
    })
    .listen(port, err => {
      if (err) throw err
      console.log('> Ready on http://localhost:3000')
    })
})
