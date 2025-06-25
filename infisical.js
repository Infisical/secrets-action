import axios from "axios";
import core from "@actions/core";
import querystring from "querystring";
import { Sha256 } from "@aws-crypto/sha256-js";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { HttpRequest } from "@aws-sdk/protocol-http";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { AWS_IDENTITY_DOCUMENT_URI, AWS_TOKEN_METADATA_URI } from "./constants";

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

export const awsIamLogin = async ({ identityId, domain }) => {
  try {
    // Get AWS region
    const region = await getAwsRegion();

    // Get AWS credentials
    const credentials = await fromNodeProviderChain()();

    if (!credentials.accessKeyId || !credentials.secretAccessKey) {
      throw new Error("AWS credentials not found");
    }

    // Create the AWS STS request
    const iamRequestURL = `https://sts.${region}.amazonaws.com/`;
    const iamRequestBody = "Action=GetCallerIdentity&Version=2011-06-15";
    const iamRequestHeaders = {
      "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      Host: `sts.${region}.amazonaws.com`,
    };

    const request = new HttpRequest({
      protocol: "https:",
      hostname: `sts.${region}.amazonaws.com`,
      path: "/",
      method: "POST",
      headers: {
        ...iamRequestHeaders,
        "Content-Length": String(Buffer.byteLength(iamRequestBody)),
      },
      body: iamRequestBody,
    });

    // Sign the request
    const signer = new SignatureV4({
      credentials,
      region,
      service: "sts",
      sha256: Sha256,
    });

    const signedRequest = await signer.sign(request);

    // Extract headers as string record
    const headers = {};
    Object.entries(signedRequest.headers).forEach(([key, value]) => {
      if (typeof value === "string") {
        // Normalize Authorization header to proper case
        const normalizedKey =
          key.toLowerCase() === "authorization" ? "Authorization" : key;
        headers[normalizedKey] = value;
      }
    });

    // Send login request to Infisical
    const loginData = querystring.stringify({
      identityId,
      iamHttpRequestMethod: "POST",
      iamRequestBody: Buffer.from(iamRequestBody).toString("base64"),
      iamRequestHeaders: Buffer.from(JSON.stringify(headers)).toString(
        "base64"
      ),
    });

    const response = await axios({
      method: "post",
      url: `${domain}/api/v1/auth/aws-auth/login`,
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

const getAwsRegion = async () => {
  const region = process.env.AWS_REGION; // Typically found in lambda runtime environment
  if (region) {
    return region;
  }

  try {
    const tokenResponse = await axios.put(
      AWS_TOKEN_METADATA_URI,
      undefined,
      {
        headers: {
          "X-aws-ec2-metadata-token-ttl-seconds": "21600"
        },
        timeout: 5_000 // 5 seconds
      }
    );

    const identityResponse = await axios.get(
      AWS_IDENTITY_DOCUMENT_URI,
      {
        headers: {
          "X-aws-ec2-metadata-token": tokenResponse.data,
          Accept: "application/json"
        },
        timeout: 5_000 // 5 seconds
      }
    );

    return identityResponse.data.region;
  } catch (error) {
    core.error(error.response?.data?.message || error.message);
    throw error;
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
