import axios from "axios";
import core from "@actions/core";
import querystring from "querystring";
import AWS from "aws-sdk";

export const UALogin = async ({ clientId, clientSecret, domain }) => {
  const loginData = querystring.stringify({
    clientId,
    clientSecret,
  });

  try {
    const response = await axios({
      method: "post",
      url: `${domain}/api/v1/auth/universal-auth/login`,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: loginData,
    });
    return response.data.accessToken;
  } catch (err) {
    core.error(err.response?.data?.message || err.message);
    throw err;
  }
};

export const oidcLogin = async ({ identityId, domain, oidcAudience }) => {
  const idToken = await core.getIDToken(oidcAudience);

  const loginData = querystring.stringify({
    identityId,
    jwt: idToken,
  });

  try {
    const response = await axios({
      method: "post",
      url: `${domain}/api/v1/auth/oidc-auth/login`,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: loginData,
    });

    return response.data.accessToken;
  } catch (err) {
    core.error(err.response?.data?.message || err.message);
    throw err;
  }
};

export const awsLogin = async ({
  identityId,
  domain,
  region = "us-east-1",
}) => {
  try {
    // Configure AWS region
    AWS.config.update({ region });

    const iamRequestURL = `https://sts.${region}.amazonaws.com/`;
    const iamRequestBody = "Action=GetCallerIdentity&Version=2011-06-15";
    const iamRequestHeaders = {
      "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      Host: `sts.${region}.amazonaws.com`,
    };

    // Create the request using AWS SDK
    const request = new AWS.HttpRequest(iamRequestURL, region);
    request.method = "POST";
    request.headers = iamRequestHeaders;
    request.headers["X-Amz-Date"] = AWS.util.date
      .iso8601(new Date())
      .replace(/[:-]|\.\d{3}/g, "");
    request.body = iamRequestBody;
    request.headers["Content-Length"] =
      Buffer.byteLength(iamRequestBody).toString();

    // Sign the request using AWS SDK
    const signer = new AWS.Signers.V4(request, "sts");
    signer.addAuthorization(AWS.config.credentials, new Date());

    const loginData = {
      identityId,
      iamHttpRequestMethod: "POST",
      iamRequestUrl: Buffer.from(iamRequestURL).toString("base64"),
      iamRequestBody: Buffer.from(iamRequestBody).toString("base64"),
      iamRequestHeaders: Buffer.from(JSON.stringify(request.headers)).toString(
        "base64"
      ),
    };

    const response = await axios({
      method: "post",
      url: `${domain}/api/v1/auth/aws-auth/login`,
      headers: {
        "Content-Type": "application/json",
      },
      data: loginData,
    });

    return response.data.accessToken;
  } catch (err) {
    core.error(err.response?.data?.message || err.message);
    throw err;
  }
};

export const getRawSecrets = async ({
  domain,
  envSlug,
  infisicalToken,
  projectSlug,
  secretPath,
  shouldIncludeImports,
  shouldRecurse,
}) => {
  try {
    const response = await axios({
      method: "get",
      url: `${domain}/api/v3/secrets/raw`,
      headers: {
        Authorization: `Bearer ${infisicalToken}`,
      },
      params: {
        secretPath,
        environment: envSlug,
        include_imports: shouldIncludeImports,
        recursive: shouldRecurse,
        workspaceSlug: projectSlug,
        expandSecretReferences: true,
      },
    });

    const keyValueSecrets = Object.fromEntries(
      response.data.secrets.map((secret) => [
        secret.secretKey,
        secret.secretValue,
      ])
    );

    // process imported secrets
    if (response.data.imports) {
      const imports = response.data.imports;
      for (let i = imports.length - 1; i >= 0; i--) {
        const importedSecrets = imports[i].secrets;
        importedSecrets.forEach((secret) => {
          if (keyValueSecrets[secret.secretKey] === undefined) {
            keyValueSecrets[secret.secretKey] = secret.secretValue;
          }
        });
      }
    }

    return keyValueSecrets;
  } catch (err) {
    core.error(err.response?.data?.message || err.message);
    throw err;
  }
};
