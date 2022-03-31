#!/usr/bin/env node
import "source-map-support/register"
import * as cdk from "@aws-cdk/core"
import { AwsCdkEcsOnFargateStack } from "../lib/infra-stack"

const app = new cdk.App()
new AwsCdkEcsOnFargateStack(app, "AwsCdkEcsOnFargateStack", {
  env: { region: "ap-northeast-1" }
})
