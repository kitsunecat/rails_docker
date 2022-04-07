import * as cdk from "@aws-cdk/core"
import * as ec2 from "@aws-cdk/aws-ec2"
import * as ecs from "@aws-cdk/aws-ecs"
import * as ecs_patterns from "@aws-cdk/aws-ecs-patterns"
import * as iam from "@aws-cdk/aws-iam"
import * as ecr from "@aws-cdk/aws-ecr"
import * as s3 from "@aws-cdk/aws-s3"
import * as rds from "@aws-cdk/aws-rds"
import * as logs from "@aws-cdk/aws-logs"
import { v4 as uuid } from "uuid"
import * as dotenv from "dotenv"
import { Duration } from "@aws-cdk/core"

dotenv.config()

export class AwsCdkEcsOnFargateStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // app name
    const resoucePrefix: string = "projectname"

    // ECR(Rails)
    const railsImageRepo = new ecr.Repository(this, "railsImageRepo", {
      repositoryName: `${resoucePrefix}-rails`,
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.MUTABLE
    })
    cdk.Tags.of(railsImageRepo).add("Name", `${resoucePrefix}-rails-image-repo`)

    // ECR(Nginx)
    const nginxImageRepo = new ecr.Repository(this, "nginxImageRepo", {
      repositoryName: `${resoucePrefix}-nginx`,
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.MUTABLE
    })
    cdk.Tags.of(nginxImageRepo).add("Name", `${resoucePrefix}-nginx-image-repo`)

    // VPC, Subnets, GW, RouteTable
    const vpc = new ec2.Vpc(this, "vpc", {
      cidr: "10.0.0.0/16",
      enableDnsHostnames: true,
      enableDnsSupport: true,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC
        }
      ]
    })
    cdk.Tags.of(vpc).add("Name", `${resoucePrefix}-vpc`)

    // security group for alb
    const albSg = new ec2.SecurityGroup(this, "albSg", {
      vpc,
      allowAllOutbound: true
    })
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80))
    albSg.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.allTraffic())
    cdk.Tags.of(albSg).add("Name", `${resoucePrefix}-alb-Sg`)

    // security group for db
    const dbSg = new ec2.SecurityGroup(this, "dbSg", {
      vpc,
      allowAllOutbound: true
    })
    dbSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(5432))
    dbSg.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.allTraffic())
    cdk.Tags.of(dbSg).add("Name", `${resoucePrefix}-db-Sg`)

    // rds
    const db = new rds.DatabaseInstance(this, "db", {
      vpc,
      vpcSubnets: {
        subnets: vpc.publicSubnets
      },
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_14_1 }),
      instanceIdentifier: `${resoucePrefix}-db`,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      allocatedStorage: 20,
      storageType: rds.StorageType.GP2,
      databaseName: process.env.DATABASE_NAME || "",
      credentials: {
        username: process.env.DATABASE_USERNAME || "",
        password: cdk.SecretValue.plainText(process.env.DATABASE_PASSWORD || "")
      },
      port: 5432,
      multiAz: true,
      securityGroups: [dbSg]
    })
    cdk.Tags.of(db).add("Name", `${resoucePrefix}-db`)

    // iam
    const ecsTaskExecutionRole = new iam.Role(this, "ecsTaskExecutionRole", {
      roleName: "ecs-task-execution-role",
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMReadOnlyAccess")
      ]
    })
    cdk.Tags.of(ecsTaskExecutionRole).add("Name", `${resoucePrefix}-ecs-task-execution-role`)

    // cluster
    const cluster = new ecs.Cluster(this, "cluster", {
      vpc,
      clusterName: `${resoucePrefix}-cluster`
    })
    cdk.Tags.of(cluster).add("Name", `${resoucePrefix}-cluster`)

    // log group
    const logGroup = new logs.LogGroup(this, "logGroup", {
      logGroupName: "/aws/cdk/ecs/projectname"
    })
    cdk.Tags.of(logGroup).add("Name", `${resoucePrefix}-log-group`)

    // task definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, "taskDefinition", {
      family: `${resoucePrefix}-app-nginx`,
      cpu: 512,
      memoryLimitMiB: 1024,
      executionRole: ecsTaskExecutionRole,
      taskRole: ecsTaskExecutionRole
    })
    cdk.Tags.of(taskDefinition).add("Name", `${resoucePrefix}-task-definition`)

    // rails container
    const railsContainer = new ecs.ContainerDefinition(this, "railsContainer", {
      containerName: "rails",
      taskDefinition,
      image: ecs.ContainerImage.fromEcrRepository(
        ecr.Repository.fromRepositoryName(this, "railsImage", `${resoucePrefix}-rails`)
      ),
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: "production",
        logGroup
      }),
      environment: {
        DATABASE_HOST: db.dbInstanceEndpointAddress,
        DATABASE_NAME: process.env.DATABASE_NAME || "",
        DATABASE_PASSWORD: process.env.DATABASE_PASSWORD || "",
        DATABASE_USERNAME: process.env.DATABASE_USERNAME || "",
        RAILS_ENV: "production",
        RAILS_MASTER_KEY: process.env.RAILS_MASTER_KEY || "",
        TZ: "Japan"
      },
      command: [
        "bash",
        "-c",
        " \
          bundle install && \
          bundle exec ridgepole --config ./config/database.yml --file ./db/schemafile.rb -E production --apply && \
          rm -f tmp/pids/server.pid && \
          bundle exec rails assets:precompile && \
          bundle exec rails server -e production \
        "
      ],
      workingDirectory: "/app_root",
      essential: true
    })

    // nginx container
    const nginxContainer = new ecs.ContainerDefinition(this, "nginxContainer", {
      containerName: "nginx",
      taskDefinition,
      image: ecs.ContainerImage.fromEcrRepository(
        ecr.Repository.fromRepositoryName(this, "nginxImage", `${resoucePrefix}-nginx`)
      ),
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: "production",
        logGroup
      }),
      portMappings: [
        {
          protocol: ecs.Protocol.TCP,
          containerPort: 80
        }
      ],
      workingDirectory: "/app_root",
      essential: true
    })

    // share volume
    nginxContainer.addVolumesFrom({
      sourceContainer: "rails",
      readOnly: false
    })

    // specify default container
    taskDefinition.defaultContainer = nginxContainer

    // S3 for logs
    const albLogsBucket = new s3.Bucket(this, `alb-logs-bucket-${uuid()}`)
    cdk.Tags.of(albLogsBucket).add("Name", `${resoucePrefix}-alb-logs-bucket`)

    // lb, target group, service
    let service = new ecs_patterns.ApplicationLoadBalancedFargateService(this, "service", {
      serviceName: `${resoucePrefix}-service`,
      cluster,
      taskDefinition,
      desiredCount: 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      assignPublicIp: true,
      healthCheckGracePeriod: cdk.Duration.seconds(300),
      publicLoadBalancer: true,
      securityGroups: [albSg, dbSg]
    })
    cdk.Tags.of(service).add("Name", `${resoucePrefix}-service`)
    service.targetGroup.healthCheck = {
      path: "/",
      healthyHttpCodes: "200",
      unhealthyThresholdCount: 5,
      timeout: Duration.seconds(15),
      interval: Duration.seconds(120),
    }

    service.loadBalancer.logAccessLogs(albLogsBucket)
  }
}