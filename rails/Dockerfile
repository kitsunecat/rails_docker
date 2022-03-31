FROM ruby:3.1.1

# yarnインストール時のバージョンを指定
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - \
  && echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list

RUN apt-get update && apt-get install -y nodejs postgresql-client yarn vim

WORKDIR /app_root

COPY Gemfile Gemfile.lock ./

RUN bundle install

COPY ./ /app_root

EXPOSE 3000