# Paths Changes Filter - Change by @Ludy87

> Smart GitHub workflows—run expensive jobs only when the relevant files actually change.

`paths-filter` is a [GitHub Action](https://github.com/features/actions) that conditionally runs workflow steps and jobs based on the files that changed in a pull request, feature branch, or recent commits. Use it to limit slow tasks—such as integration tests or deployments—to the components that need them, especially in monorepos.

> **Note:** This Action builds upon the work by [Ludy87](https://github.com/Ludy87/paths-filter) and is customized for this project.

## Table of contents

- [Paths Changes Filter - Change by @Ludy87](#paths-changes-filter---change-by-ludy87)
  - [Table of contents](#table-of-contents)
  - [Motivation](#motivation)
  - [Requirements](#requirements)
  - [Repository setup](#repository-setup)
  - [Local development](#local-development)
  - [Testing the action locally](#testing-the-action-locally)
  - [Supported workflows](#supported-workflows)
  - [Quickstart](#quickstart)
  - [Example](#example)
  - [Notes](#notes)
  - [What's new](#whats-new)
  - [Usage](#usage)
  - [Outputs](#outputs)
  - [Examples](#examples)
    - [Conditional execution](#conditional-execution)
    - [Change detection workflows](#change-detection-workflows)
    - [Advanced options](#advanced-options)
    - [Custom processing of changed files](#custom-processing-of-changed-files)
    - [Workflow examples](#workflow-examples)
  - [Additional resources](#additional-resources)
  - [License](#license)

## Motivation

GitHub provides [path filters](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions#onpushpull_requestpaths), but they only work at the workflow level. `paths-filter` fills the gap by reacting to changed files inside individual jobs and steps.

**Real-world examples:**

- [sentry.io](https://sentry.io/) – [backend.yml](https://github.com/getsentry/sentry/blob/2ebe01feab863d89aa7564e6d243b6d80c230ddc/.github/workflows/backend.yml#L36)
- [GoogleChrome/web.dev](https://web.dev/) – [lint-workflow.yml](https://github.com/GoogleChrome/web.dev/blob/3a57b721e7df6fc52172f676ca68d16153bda6a3/.github/workflows/lint-workflow.yml#L26)
- [Configuring python linting to be part of CI/CD using GitHub actions](https://dev.to/freshbooks/configuring-python-linting-to-be-part-of-cicd-using-github-actions-1731#what-files-does-it-run-against) – [py_linter.yml](https://github.com/iamtodor/demo-github-actions-python-linter-configuration/blob/main/.github/workflows/py_linter.yml#L31)

## Requirements

- Node.js 20 or newer

## Repository setup

Clone the repository and install the dependencies once per checkout:

```bash
git clone https://github.com/Ludy87/paths-filter.git
cd paths-filter
npm install
```

The project uses a conventional Node.js toolchain. All commands shown in this README are available through `npm run <script>`.

## Local development

Use the provided scripts to iterate on the Action codebase:

- `npm run build` – compile the TypeScript sources into `dist/`.
- `npm run lint` – ensure the source code follows the repository style guide.
- `npm run format` / `npm run format-check` – apply or verify Prettier formatting.
- `npm test` – run the Jest test suite.
- `npm run pack` – bundle the Action with `@vercel/ncc` before publishing.

You can chain several tasks with `npm run all` to perform the typical release pipeline locally. Each command reads configuration from the `tsconfig*.json`, `eslint.config.mjs`, and `jest.config.cjs` files shipped with the repository.

## Testing the action locally

The Action can be smoke-tested outside GitHub using [`act`](https://github.com/nektos/act). Ensure you use a runner image that contains Git:

```bash
act -P ubuntu-latest=nektos/act-environments-ubuntu:18.04
```

Point the `filters` input to one of the sample files (for example `sample-filters.yml` or any file under [`examples/`](./examples)) to simulate different change detection scenarios.

## Supported workflows

- **Pull requests:**
  - Workflow triggered by **[pull_request](https://docs.github.com/en/actions/reference/events-that-trigger-workflows#pull_request)**
    or **[pull_request_target](https://docs.github.com/en/actions/reference/events-that-trigger-workflows#pull_request_target)** event
  - Changes are detected against the pull request base branch
  - Uses the GitHub REST API to fetch a list of modified files
  - Requires [pull-requests: read](https://docs.github.com/en/actions/using-jobs/assigning-permissions-to-jobs) permission
- **Feature branches:**
  - Workflow triggered by **[push](https://docs.github.com/en/actions/reference/events-that-trigger-workflows#push)**
    or any other **[event](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows)**
  - The `base` input parameter must not be the same as the branch that triggered the workflow
  - Changes are detected against the merge-base with the configured base branch or the default branch
  - Uses Git commands to detect changes—repositories must already be [checked out](https://github.com/actions/checkout)
- **Master, release, or other long-lived branches:**
  - Workflow triggered by **[push](https://docs.github.com/en/actions/reference/events-that-trigger-workflows#push)** event
    when `base` input parameter is the same as the branch that triggered the workflow:
    - Changes are detected against the most recent commit on the same branch before the push
  - Workflow triggered by any other **[event](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows)**
    when `base` input parameter is commit SHA:
    - Changes are detected against the provided `base` commit
  - Workflow triggered by any other **[event](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows)**
    when `base` input parameter is the same as the branch that triggered the workflow:
    - Changes are detected from the last commit
  - Uses Git commands to detect changes—repositories must already be [checked out](https://github.com/actions/checkout)
- **Local changes**
  - Workflow triggered by any event when the `base` input parameter is set to `HEAD`
  - Changes are detected against the current HEAD
  - Untracked files are ignored

## Quickstart

```yaml
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: Ludy87/paths-filter@v3
        id: changes
        with:
          filters: |
            src:
              - 'src/**'
            docs:
              - 'docs/**'

      - name: Run tests for updated services
        if: steps.changes.outputs.src == 'true'
        run: npm run test

      - name: Build documentation
        if: steps.changes.outputs.docs == 'true'
        run: npm run docs:build
```

This configuration gets you up and running in minutes.

## Example

```yaml
- uses: Ludy87/paths-filter@v3
  id: changes
  with:
    filters: |
      src:
        - 'src/**'

# Run only if a file in the `src` folder changed
- if: steps.changes.outputs.src == 'true'
  run: ...
```

For a more complete example, see [sample-filters.yml](./sample-filters.yml).

Additional scenarios live in the [Examples](#examples) section.

## Notes

- Path expressions are evaluated using the [picomatch](https://github.com/micromatch/picomatch) library; consult its documentation for glob syntax details.
- The picomatch [dot](https://github.com/micromatch/picomatch#options) option is set to `true`, so globbing also matches dotfiles and dot-directories.
- Quote your path expressions with `'` or `"`; otherwise shell expansion may fail when the expression starts with `*`.
- Local execution with [act](https://github.com/nektos/act) works only with an alternative runner image. The default runner does not include `git`.
  - Use `act -P ubuntu-latest=nektos/act-environments-ubuntu:18.04`.

## What's new

- Major release `v3` after upgrading to Node 20 (**breaking change**)
- Added the `ref` input parameter
- Added `list-files: csv` format
- Added `list-files: lines` format
- Added `list-files: json-detailed` format
- Configure a matrix job to run for each folder with changes using the `changes` output
- Improved listing of matching files with the `list-files: shell` and `list-files: escape` options
- Added optional `write-to-files` support to export matched files to temporary files
- Path expressions are now evaluated using the [picomatch](https://github.com/micromatch/picomatch) library

For more information, see the [CHANGELOG](https://github.com/Ludy87/paths-filter/blob/master/CHANGELOG.md).

## Usage

```yaml
- uses: Ludy87/paths-filter@v3
  with:
    # Defines filters applied to detected changed files.
    # Each filter has a name and a list of rules.
    # A rule is a glob expression—paths of all changed
    # files are matched against it.
    # Rules can optionally specify if the file
    # should be added, modified, or deleted.
    # For each filter, there will be a corresponding output variable to
    # indicate if there's a changed file matching any of the rules.
    # Optionally, there can be a second output variable
    # set to the list of all files matching the filter.
    # Filters can be provided inline as a string (containing valid YAML),
    # or as a relative path to a file (e.g. .github/filters.yaml).
    # Filters syntax is documented by example—see the Examples section.
    filters: ''

    # Branch, tag, or commit SHA against which the changes will be detected.
    # If it references the same branch it was pushed to,
    # changes are detected against the most recent commit before the push.
    # Otherwise, it uses git merge-base to find the best common ancestor between
    # current branch (HEAD) and base.
    # When merge-base is found, it's used for change detection—only changes
    # introduced by the current branch are considered.
    # All files are considered as added if there is no common ancestor with
    # the base branch or no previous commit.
    # This option is ignored if the action is triggered by a pull_request event.
    # Default: repository default branch (e.g. master)
    base: ''

    # Git reference (e.g. branch name) from which the changes will be detected.
    # Useful when the workflow can be triggered only on the default branch (e.g. repository_dispatch event)
    # but you want to get changes on a different branch.
    # This option is ignored if the action is triggered by a pull_request event.
    # Default: ${{ github.ref }}
    ref:

    # How many commits are initially fetched from the base branch.
    # If needed, each subsequent fetch doubles the
    # previously requested number of commits until the merge-base
    # is found, or there are no more commits in the history.
    # This option takes effect only when changes are detected
    # using git against the base branch (feature branch workflow).
    # Default: 100
    initial-fetch-depth: ''

    # Enables listing of files matching the filter:
    #   'none'  - Disables listing of matching files (default).
    #   'csv'   - Comma separated list of filenames.
    #             If needed, it uses double quotes to wrap filenames with unsafe characters.
    #   'json'  - File paths formatted as a JSON array.
    #   'shell' - Space-delimited list usable as command-line arguments in a Linux shell.
    #             If needed, it uses single or double quotes to wrap filenames with unsafe characters.
    #   'escape'- Space-delimited list usable as command-line arguments in a Linux shell.
    #             Backslashes escape every potentially unsafe character.
    #   'lines' - Newline-delimited list of files without any escaping.
    # Default: none
    list-files: ''

    # Writes the list of matching files for each filter to a temporary file and
    # exposes the path via an additional `${FILTER_NAME}_files_path` output.
    # Has an effect only when `list-files` is set to a format other than 'none'.
    # Default: false
    write-to-files: ''

    # Relative path under $GITHUB_WORKSPACE where the repository was checked out.
    working-directory: ''

    # Personal access token used to fetch a list of changed files
    # from the GitHub REST API.
    # It's only used if the action is triggered by a pull request event.
    # The GitHub token from the workflow context is the default value.
    # If an empty string is provided, the action falls back to detecting
    # changes using git commands.
    # Default: ${{ github.token }}
    token: ''

    # Optional parameter to override the default behavior of the file matching algorithm.
    # By default files that match at least one pattern defined by the filters are included.
    # This parameter allows overriding the "at least one pattern" behavior so that
    # all patterns have to match; otherwise the file is excluded.
    # This is useful when you want to match all .ts files in a sub-directory but not .md files.
    # The filters below match markdown files despite the exclusion syntax UNLESS
    # you specify 'every' as the predicate-quantifier parameter. When you do that,
    # it will only match the .ts files in the subdirectory as expected.
    #
    # backend:
    #  - 'pkg/a/b/c/**'
    #  - '!**/*.jpeg'
    #  - '!**/*.md'
    predicate-quantifier: 'some'
```

## Outputs

- For each filter, the action sets an output variable named after the filter with the value:
  - `'true'` if **any** changed files match any of the filter rules
  - `'false'` if **none** of the changed files match any of the filter rules
- For each filter, it sets an output variable named `${FILTER_NAME}_count` to the number of matching files.
- If enabled, for each filter it sets an output variable named `${FILTER_NAME}_files`. It contains the list of all files matching the filter.
- `all_changed` – `'true'` only if every filter matches at least one changed file; otherwise `'false'`.
- `any_changed` – `'true'` if **any** filter matches at least one changed file; otherwise `'false'`.
- `changes` – JSON array listing all filters that matched at least one changed file.
- `${FILTER_NAME}_files_path` – Absolute path to the temporary file containing the
  serialized list of matching files (available only when `write-to-files` is enabled
  and the filter matched at least one file).

## Examples

### Conditional execution

<details>
  <summary>Execute a <strong>step</strong> in a workflow job only if files in a subfolder changed</summary>

```yaml
jobs:
  tests:
    runs-on: ubuntu-latest
    # Required permissions
    permissions:
      contents: read # required by actions/checkout
      pull-requests: read # required by Ludy87/paths-filter
    steps:
      - uses: actions/checkout@v5.0.0
      - uses: Ludy87/paths-filter@v3
        id: filter
        with:
          filters: |
            backend:
              - 'backend/**'
            frontend:
              - 'frontend/**'

      # Run only if `backend` files were changed
      - name: backend tests
        if: steps.filter.outputs.backend == 'true'
        run: ...

      # Run only if `frontend` files were changed
      - name: frontend tests
        if: steps.filter.outputs.frontend == 'true'
        run: ...

      # Run if `backend` or `frontend` files were changed
      - name: e2e tests
        if: steps.filter.outputs.backend == 'true' || steps.filter.outputs.frontend == 'true'
        run: ...
```

</details>

<details>
  <summary>Execute a <strong>job</strong> in a workflow only if files in a subfolder changed</summary>

```yaml
jobs:
  # Job to run change detection
  changes:
    runs-on: ubuntu-latest
    # Required permissions
    permissions:
      pull-requests: read
    # Set job outputs to values from the filter step
    outputs:
      backend: ${{ steps.filter.outputs.backend }}
      frontend: ${{ steps.filter.outputs.frontend }}
    steps:
      # For pull requests it's not necessary to check out the code
      - uses: Ludy87/paths-filter@v3
        id: filter
        with:
          filters: |
            backend:
              - 'backend/**'
            frontend:
              - 'frontend/**'

  # Job to build and test backend code
  backend:
    needs: changes
    if: ${{ needs.changes.outputs.backend == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5.0.0
      - ...

  # Job to build and test frontend code
  frontend:
    needs: changes
    if: ${{ needs.changes.outputs.frontend == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5.0.0
      - ...
```

</details>

<details>
  <summary>Use change detection to configure a matrix job</summary>

```yaml
jobs:
  # Job to run change detection
  changes:
    runs-on: ubuntu-latest
    # Required permissions
    permissions:
      pull-requests: read
    outputs:
      # Expose matched filters as the job `packages` output variable
      packages: ${{ steps.filter.outputs.changes }}
    steps:
      # For pull requests it's not necessary to check out the code
      - uses: Ludy87/paths-filter@v3
        id: filter
        with:
          filters: |
            package1: src/package1
            package2: src/package2

  # Job to build and test each modified package
  build:
    needs: changes
    strategy:
      matrix:
        # Parse JSON array containing the names of all filters matching any changed files
        # e.g. ['package1', 'package2'] if both package folders contain changes
        package: ${{ fromJSON(needs.changes.outputs.packages) }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5.0.0
      - ...
```

</details>

<details>
  <summary>Use <code>any_changed</code> and <code>all_changed</code> outputs</summary>

The <code>any_changed</code> output is <code>true</code> when at least one file
defined in the filters is added, copied, deleted, modified, renamed, or
unmerged. The <code>all_changed</code> output is <code>true</code> only when every
filter matches at least one such file.

`.github/config/.test.yaml`

```yaml
test1: &test1
  - test1.txt

test2: &test2
  - test2.txt

test3: &test3
  - test3.txt

test4: &test4
  - test4.txt
```

`.github/workflows/build.yml`

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    # Required permissions
    permissions:
      contents: read # required by actions/checkout
      pull-requests: read # required by Ludy87/paths-filter
    steps:
      - uses: actions/checkout@v5.0.0
      - name: Check for file changes
        uses: Ludy87/paths-filter@v3
        id: change
        with:
          filters: '.github/config/.test.yaml'

      - name: React to any change
        if: steps.change.outputs.any_changed == 'true'
        run: echo "frontend-any=${{ steps.change.outputs.any_changed }}"
      - name: React when all changed
        if: steps.change.outputs.all_changed == 'true'
        run: echo "frontend-all=${{ steps.change.outputs.all_changed }}"
```

</details>

### Change detection workflows

<details>
  <summary><strong>Pull requests:</strong> Detect changes against the PR base branch</summary>

```yaml
on:
  pull_request:
    branches: # PRs to the following branches will trigger the workflow
      - master
      - develop
jobs:
  build:
    runs-on: ubuntu-latest
    # Required permissions
    permissions:
      contents: read      # required by actions/checkout
      pull-requests: read # required by Ludy87/paths-filter
    steps:
    - uses: actions/checkout@v5.0.0
    - uses: Ludy87/paths-filter@v3
      id: filter
...
    branches: # Push to the following branches will trigger the workflow
      - master
      - develop
      - release/**
jobs:
  build:
    runs-on: ubuntu-latest
    # Required permissions
    permissions:
      contents: read      # required by actions/checkout
      pull-requests: read # required by Ludy87/paths-filter
    steps:
    - uses: actions/checkout@v5.0.0

      # Some action that modifies files tracked by git (e.g. code linter)
    - uses: johndoe/some-action@v1

      # Filter to detect which files were modified
      # Changes could be, for example, automatically committed
    - uses: Ludy87/paths-filter@v3
      id: filter
      with:
        base: HEAD
        filters: ... # Configure your filters
```

</details>

### Advanced options

<details>
  <summary>Define filter rules in a dedicated file</summary>

```yaml
- uses: Ludy87/paths-filter@v3
      id: filter
      with:
        # Path to the file where filters are defined
        filters: .github/filters.yaml
```

</details>

<details>
  <summary>Use YAML anchors to reuse path expression(s) inside another rule</summary>

```yaml
- uses: Ludy87/paths-filter@v3
      id: filter
      with:
        # &shared is the YAML anchor,
        # *shared references the previously defined anchor
        # The `src` filter will match any path under common, config, and src folders
        filters: |
          shared: &shared
            - common/**
            - config/**
          src:
            - *shared
            - src/**
```

</details>

<details>
  <summary>Consider whether a file was added, modified, or deleted</summary>

```yaml
- uses: Ludy87/paths-filter@v3
      id: filter
      with:
        # A changed file can be 'added', 'modified', or 'deleted'.
        # By default, the type of change is not considered.
        # Optionally, it's possible to specify it using a nested
        # dictionary, where the type of change composes the key.
        # Multiple change types can be specified using `|` as the delimiter.
        filters: |
          shared: &shared
            - common/**
            - config/**
          addedOrModified:
            - added|modified: '**'
          allChanges:
            - added|deleted|modified: '**'
          addedOrModifiedAnchors:
            - added|modified: *shared
```

</details>

<details>
  <summary>Detect changes in a folder only for certain file extensions</summary>

```yaml
- uses: Ludy87/paths-filter@v3
      id: filter
      with:
        # This requires all patterns to match a file for it to be
        # considered changed. Because we exclude .jpeg and .md files,
        # changes to those files are ignored.
        #
        # Use this to build & test only when code changes occur—for example,
        # react to TypeScript updates but skip Markdown-only updates.
        predicate-quantifier: 'every'
        filters: |
          backend:
            - 'pkg/a/b/c/**'
            - '!**/*.jpeg'
            - '!**/*.md'
```

</details>

### Custom processing of changed files

<details>
  <summary>Pass a list of modified files as command-line arguments in a Linux shell</summary>

```yaml
- uses: Ludy87/paths-filter@v3
  id: filter
  with:
    # Enable listing of files matching each filter.
    # Paths to files will be available in the `${FILTER_NAME}_files` output variable.
    # Paths will be escaped and space-delimited.
    # Output is usable as command-line arguments in a Linux shell.
    list-files: shell

    # In this example changed files will be checked by a linter.
    # It doesn't make sense to lint deleted files.
    # Therefore we specify that we are only interested in added or modified files.
    filters: |
      markdown:
        - added|modified: '*.md'
- name: Lint Markdown
  if: ${{ steps.filter.outputs.markdown == 'true' }}
  run: npx textlint ${{ steps.filter.outputs.markdown_files }}
```

</details>

<details>
  <summary>Pass a list of modified files as a JSON array to another action</summary>

```yaml
- uses: Ludy87/paths-filter@v3
  id: filter
  with:
    # Enable listing of files matching each filter.
    # Paths to files will be available in the `${FILTER_NAME}_files` output variable.
    # Paths will be formatted as a JSON array.
    list-files: json

    # In this example all changed files are passed to the following action for
    # custom processing.
    filters: |
      changed:
        - '**'
- name: Lint Markdown
  uses: johndoe/some-action@v1
  with:
    files: ${{ steps.filter.outputs.changed_files }}
```

</details>

<details>
  <summary>Forward structured change metadata to downstream steps</summary>

```yaml
- uses: Ludy87/paths-filter@v3
  id: filter
  with:
    # Enable listing of files matching each filter.
    # Paths to files will be available in the `${FILTER_NAME}_files` output variable.
    # Values are encoded as JSON objects including the change status and source/target names.
    list-files: json-detailed

    filters: |
      backend:
        - '**/*.ts'

- name: Summarize file changes
  env:
    CHANGES: ${{ steps.filter.outputs.backend_files }}
  run: |
    echo "Detected changes: ${CHANGES}"
```

</details>

### Workflow examples

- [`examples/basic-workflow.yml`](./examples/basic-workflow.yml) – Full monorepo-style workflow wiring change detection job outputs into subsequent jobs.
- [`examples/list-files.yml`](./examples/list-files.yml) – Demonstrates how to enable `list-files`, consume the generated outputs, and make use of the exported file lists.
- [`sample-filters.yml`](./sample-filters.yml) – Self-contained filter definitions that can be reused across workflows.

## Additional resources

- [sample-filters.yml](./sample-filters.yml) – Reference configuration containing multiple filters
- [CHANGELOG](./CHANGELOG.md) – History of all changes and migration notes
- [test-reporter](https://github.com/dorny/test-reporter) – Companion action for surfacing test results directly in GitHub

## License

The scripts and documentation in this project are released under the [MIT License](./LICENSE).
