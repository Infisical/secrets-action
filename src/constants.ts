export const AWS_TOKEN_METADATA_URI = "http://169.254.169.254/latest/api/token";
export const AWS_IDENTITY_DOCUMENT_URI = "http://169.254.169.254/latest/dynamic/instance-identity/document";

export const AuthMethod = {
    Universal: "universal",
    Oidc: "oidc",
    AwsIam: "aws-iam"
}