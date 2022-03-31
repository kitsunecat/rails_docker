# README

## 環境構築

最初のデプロイでは`bundle exec rails db:create`が必要

## 実装

ckdの変更があったら自動的にコンパイルする

```sh
cd infra
npm run watch
```

## デプロイ

### build containers

```sh
docker-compose up --build

```

### aws-cli login

```sh
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin <repository id>.dkr.ecr.ap-northeast-1.amazonaws.com

```

### push nginx container

```sh
docker tag rails_docker_nginx:latest <repository id>.dkr.ecr.ap-northeast-1.amazonaws.com/projectname-nginx:latest
docker push <repository id>.dkr.ecr.ap-northeast-1.amazonaws.com/projectname-nginx:latest
```

### push rails container

```sh
docker tag rails_docker_rails:latest <repository id>.dkr.ecr.ap-northeast-1.amazonaws.com/projectname-rails:latest
docker push <repository id>.dkr.ecr.ap-northeast-1.amazonaws.com/projectname-rails:latest
```

### deploy

```sh
cd infra
npm run build
cdk synth --profile default
cdk deploy --profile default
cd ../
```
