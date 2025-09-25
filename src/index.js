import core from "@actions/core";
import { UALogin, getRawSecrets, oidcLogin, awsIamLogin, createAxiosInstance } from "./infisical.js";
import fs from "fs/promises";
import { AuthMethod } from "./constants.js";

function parseHeadersInput(inputKey) {
  const rawHeadersString = core.getInput(inputKey) || '';

  const headerStrings = rawHeadersString
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '');

  const parsedHeaderStrings = headerStrings
    .reduce((obj, line) => {
      const seperator = line.indexOf(':');
      const key = line.substring(0, seperator).trim().toLowerCase();
      const value = line.substring(seperator + 1).trim();
      if (obj[key]) {
        obj[key] = [obj[key], value].join(', ');
      } else {
        obj[key] = value;
      }
      return obj;
    }, {});

  return parsedHeaderStrings;
}

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
  const extraHeaders = parseHeadersInput("extra-headers");

  // get infisical token using credentials
  let infisicalToken;

  const axiosInstance = createAxiosInstance(domain, extraHeaders);

  switch (method) {
    case AuthMethod.Universal: {
      if (!(UAClientId && UAClientSecret)) {
        throw new Error("Missing universal auth credentials");
      }
      infisicalToken = await UALogin({
        axiosInstance,
        clientId: UAClientId,
        clientSecret: UAClientSecret
      });
      break;
    }
    case AuthMethod.Oidc: {
      if (!identityId) {
        throw new Error("Missing identity ID for OIDC auth");
      }
      infisicalToken = await oidcLogin({
        axiosInstance,
        identityId,
        oidcAudience
      });
      break;
    }
    case AuthMethod.AwsIam: {
      if (!identityId) {
        throw new Error("Missing identity ID for AWS IAM auth");
      }
      infisicalToken = await awsIamLogin({
        axiosInstance,
        identityId
      });
      break;
    }
    default:
      throw new Error(`Invalid authentication method: ${method}`);
  }

  // get secrets from Infisical using input params
  const keyValueSecrets = await getRawSecrets({
    axiosInstance,
    envSlug,
    infisicalToken,
    projectSlug,
    secretPath,
    shouldIncludeImports,
    shouldRecurse
  });

  core.debug(`Exporting the following envs", ${JSON.stringify(Object.keys(keyValueSecrets))}`);

  // export fetched secrets
  if (exportType === "env") {
    // Write the secrets to action ENV
    Object.entries(keyValueSecrets).forEach(([key, value]) => {
      core.setSecret(value);
      core.exportVariable(key, value);
    });
    core.info("Injected secrets as environment variables");
  } else if (exportType === "file") {
    // Write the secrets to a file at the specified path
    const fileContent = Object.keys(keyValueSecrets)
      .map(key => `${key}='${keyValueSecrets[key]}'`)
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
