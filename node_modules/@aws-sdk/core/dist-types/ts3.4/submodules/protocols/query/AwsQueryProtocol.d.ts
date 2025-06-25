import { RpcProtocol } from "@smithy/core/protocols";
import {
  Codec,
  EndpointBearer,
  HandlerExecutionContext,
  HttpRequest,
  MetadataBearer,
  OperationSchema,
  ResponseMetadata,
  SerdeFunctions,
} from "@smithy/types";
import { HttpResponse as IHttpResponse } from "@smithy/types/dist-types/http";
import { XmlShapeDeserializer } from "../xml/XmlShapeDeserializer";
import { QueryShapeSerializer } from "./QueryShapeSerializer";
export declare class AwsQueryProtocol extends RpcProtocol {
  options: {
    defaultNamespace: string;
    xmlNamespace: string;
    version: string;
  };
  protected serializer: QueryShapeSerializer;
  protected deserializer: XmlShapeDeserializer;
  constructor(options: {
    defaultNamespace: string;
    xmlNamespace: string;
    version: string;
  });
  getShapeId(): string;
  setSerdeContext(serdeContext: SerdeFunctions): void;
  getPayloadCodec(): Codec<any, any>;
  serializeRequest<Input extends object>(
    operationSchema: OperationSchema,
    input: Input,
    context: HandlerExecutionContext & SerdeFunctions & EndpointBearer
  ): Promise<HttpRequest>;
  deserializeResponse<Output extends MetadataBearer>(
    operationSchema: OperationSchema,
    context: HandlerExecutionContext & SerdeFunctions,
    response: IHttpResponse
  ): Promise<Output>;
  protected useNestedResult(): boolean;
  protected handleError(
    operationSchema: OperationSchema,
    context: HandlerExecutionContext & SerdeFunctions,
    response: IHttpResponse,
    dataObject: any,
    metadata: ResponseMetadata
  ): Promise<never>;
  protected loadQueryErrorCode(
    output: IHttpResponse,
    data: any
  ): string | undefined;
  protected loadQueryError(data: any): any | undefined;
  protected loadQueryErrorMessage(data: any): string;
}
