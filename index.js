import core from "@actions/core";
import { UALogin, getRawSecrets, oidcLogin } from "./infisical.js";
import fs from "fs/promises";

try {
  const method = core.getInput("method");
  const UAClientId = core.getInput("client-id");
  const UAClientSecret = core.getInput("client-secret");
  const identityId = core.getInput("identity-id");
  const oidcAudience = core.getInput("oidc-audience");
  const domain = core.getInput("domain");
  const envSlug = core.getInput("env-slug");
  const projectSlug = core.getInput("project-slug");
  const secretPath = core.getInput("secret-path");
  const exportType = core.getInput("export-type");
  const fileOutputPath = core.getInput("file-output-path");
  const shouldIncludeImports = core.getBooleanInput("include-imports");
  const shouldRecurse = core.getBooleanInput("recursive");

  // get infisical token using UA credentials
  let infisicalToken;

  switch (method) {
    case "universal": {
      if (!(UAClientId && UAClientSecret)) {
        throw new Error("Missing universal auth credentials");
      }
      infisicalToken = await UALogin({
        domain,
        clientId: UAClientId,
        clientSecret: UAClientSecret,
      });
      break;
    }
    case "oidc": {
      if (!identityId) {
        throw new Error("Missing identity ID");
      }
      infisicalToken = await oidcLogin({
        domain,
        identityId,
        oidcAudience,
      });
      break;
    }
    default:
      throw new Error("Invalid authentication method");
  }

  // get secrets from Infisical using input params
  const keyValueSecrets = await getRawSecrets({
    domain,
    envSlug,
    infisicalToken,
    projectSlug,
    secretPath,
    shouldIncludeImports,
    shouldRecurse,
  });

  // Mask secrets in GitHub logs
  Object.entries(keyValueSecrets).forEach(([, value]) => {
    core.setSecret(value);
  });

  core.debug(
    `Exporting the following envs", ${JSON.stringify(
      Object.keys(keyValueSecrets)
    )}`
  );

  // export fetched secrets
  if (exportType === "env") {
    // Write the secrets to action ENV
    Object.entries(keyValueSecrets).forEach(([key, value]) => {
      core.exportVariable(key, value);
    });
    core.info("Injected secrets as environment variables");
  } else if (exportType === "file") {
    // Write the secrets to a file at the specified path
    const fileContent = Object.keys(keyValueSecrets)
      .map((key) => `${key}='${keyValueSecrets[key]}'`)
      .join("\n");

    try {
      const filePath = `${process.env.GITHUB_WORKSPACE}${fileOutputPath}`;
      core.info(`Exporting secrets to ${filePath}`);
      await fs.writeFile(filePath, fileContent);
    } catch (err) {
      core.error(`Error writing file: ${err.message}`);
      throw err;
    }
    core.info("Successfully exported secrets to file");
  }
} catch (error) {
  core.setFailed(error.message);
}
