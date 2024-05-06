# Infisical Secrets Loader Action
This action will allow you to load secrets from Infisical(cloud/self-hosted) into your Github workflows

## Configuration
- In order to use this, you will need to configure a [Machine Identity](https://infisical.com/docs/documentation/platform/identities/universal-auth) for your project.
- Extract the machine identity's `client_id` and `client_secret` and store them as Github secrets (recommended) or environment variables.
  
## Usage
You can use the secrets in two ways, as environment variables or as a file 

### As environment variables
This will inject your Infisical secrets as environment variables of your workflow. Preceding steps of your Github job will be able to access the secret values by reading from the ENV.

```yaml
      - uses: Infisical/secrets-loader-action@v1.0.0
        with:
          client-id: ${{ secrets.MACHINE_IDENTITY_CLIENT_ID }}
          client-secret: ${{ secrets.MACHINE_IDENTITY_CLIENT_SECRET }}
          env-slug: "dev"
          project-slug: "example-project-r-i3x"
```

### As a file
```yaml
      - uses: Infisical/secrets-loader-action@main
        with:
          client-id: ${{ secrets.MACHINE_IDENTITY_CLIENT_ID }}
          client-secret: ${{ secrets.MACHINE_IDENTITY_CLIENT_SECRET }}
          env-slug: "dev"
          project-slug: "example-project-r-i3x"
          export-type: "file"
          file-output-path: "/src/" #defaults to "/"
```


## Inputs
