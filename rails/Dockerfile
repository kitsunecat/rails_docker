FROM ruby:3.1.1

# yarnインストール時のバージョンを指定
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - \
  && echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list

RUN apt-get update && apt-get install -y nodejs postgresql-client yarn

WORKDIR /app_root

COPY Gemfile Gemfile.lock ./

RUN bundle install

COPY ./ /app_root

VOLUME /app_root/public
VOLUME /app_root/tmp

EXPOSE 3000