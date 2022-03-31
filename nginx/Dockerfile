FROM nginx:alpine

RUN rm -f /etc/nginx/conf.d/*

ADD ./nginx.conf /etc/nginx/nginx.conf
ADD ./default.conf /etc/nginx/conf.d/default.conf

WORKDIR /app_root

CMD /usr/sbin/nginx -g 'daemon off;' -c /etc/nginx/nginx.conf
