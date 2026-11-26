import type { UserConfig } from '@commitlint/types'

const config: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      1,
      'always',
      [
        'desktop',
        'ui',
        'videos',
        'images',
        'downloads',
        'rust',
        'deps',
        'ci',
        'docker',
        'test',
        'e2e',
        'release',
        'skills',
      ],
    ],
    'body-max-line-length': [0],
  },
}

export default config
