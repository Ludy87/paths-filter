#!/usr/bin/env node
const { readFileSync, writeFileSync, existsSync } = require('fs')

function bump(version, release) {
  const parts = version.split('.').map(Number)
  if (release === 'major') {
    parts[0]++
    parts[1] = 0
    parts[2] = 0
  } else if (release === 'minor') {
    parts[1]++
    parts[2] = 0
  } else {
    parts[2]++
  }
  return parts.join('.')
}

const release = process.argv[2] || 'patch'
if (!['major', 'minor', 'patch'].includes(release)) {
  console.error('Release type must be major, minor, or patch')
  process.exit(1)
}
const pkgPath = 'package.json'
const lockPath = 'package-lock.json'

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const newVersion = bump(pkg.version, release)
pkg.version = newVersion
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

if (existsSync(lockPath)) {
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
  lock.version = newVersion
  if (lock.packages && lock.packages['']) {
    lock.packages[''].version = newVersion
  }
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n')
}

console.log(`Version updated to ${newVersion}`)
