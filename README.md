# Infisical Secrets Action

This GitHub Action enables you to import secrets from Infisical—whether hosted in the cloud or self-hosted—directly into your GitHub workflows.

## Configuration

- In order to use this, you will need to configure a [Machine Identity](https://infisical.com/docs/documentation/platform/identities/universal-auth) for your project.
- Extract the machine identity's `client_id` and `client_secret` and store them as Github secrets (recommended) or environment variables.

## Usage

With this action, you can use your Infisical secrets in two ways: as environment variables or as a file.

### As environment variables

Secrets are injected as environment variables and can be referenced by subsequent workflow steps.

```yaml
- uses: Infisical/secrets-action@v1.0.5
  with:
    client-id: ${{ secrets.MACHINE_IDENTITY_CLIENT_ID }} # Update this to your own Github references
    client-secret: ${{ secrets.MACHINE_IDENTITY_CLIENT_SECRET }} # Update this to your own Github references
    env-slug: "dev"
    project-slug: "example-project-r-i3x"
```

### As a file

Exports secrets to a file in your `GITHUB_WORKSPACE`, useful for applications that read from `.env` files.

```yaml
- uses: Infisical/secrets-action@v1.0.5
  with:
    client-id: ${{ secrets.MACHINE_IDENTITY_CLIENT_ID }} # Update this to your own Github references
    client-secret: ${{ secrets.MACHINE_IDENTITY_CLIENT_SECRET }} # Update this to your own Github references
    env-slug: "dev"
    project-slug: "example-project-r-i3x"
    export-type: "file"
    file-output-path: "/src/.env" # defaults to "/.env"
```

**Note**: Make sure to configure an `actions/checkout` step before using this action in file export mode

```yaml
steps:
  - name: Checkout code
    uses: actions/checkout@v4
```

## Inputs

### `client-id`

**Required**. Machine Identity client ID

### `client-secret`

**Required**. Machine Identity secret key

### `project-slug`

**Required**. Source project slug

### `env-slug`

**Required**. Source environment slug

### `domain`

**Optional**. Infisical URL. Defaults to https://app.infisical.com

### `export-type`

**Optional**. If set to `env`, it will set the fetched secrets as environment variables for subsequent steps of a workflow. If set to `file`, it will export the secrets in a .env file in the defined file-output-path. Defaults to `env`

### `file-output-path`

**Optional**. The path to save the file when export-type is set to `file`. Defaults to `/.env`

### `secret-path`

**Optional**. Source secret path. Defaults to `/`

### `include-imports`

**Optional**. If set to `true`, it will include imported secrets. Defaults to `true`

### `recursive`

**Optional**. If set to `true`, it will fetch all secrets from the specified base path and all of its subdirectories. Defaults to `false`
