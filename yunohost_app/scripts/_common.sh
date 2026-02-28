#!/bin/bash

# shellcheck disable=SC2034
pkg_dependencies="git nodejs npm python3 python3-venv"

_pandora_set_paths() {
  app="$YNH_APP_INSTANCE_NAME"
  install_dir="/opt/yunohost/$app"
  data_dir="/var/lib/$app"
  log_dir="/var/log/$app"
  env_file="/etc/$app/env"
  backend_service="${app}-backend"
  ai_service="${app}-ai"
}

_pandora_write_env() {
  local backend_port="$1"
  local ai_port="$2"

  mkdir -p "$(dirname "$env_file")"
  cat >"$env_file" <<EOF
NODE_ENV=production
PORT=$backend_port
AI_PORT=$ai_port
AI_HOST=127.0.0.1
FLASK_ENV=production
EOF
}

_pandora_install_systemd() {
  cp "../conf/backend.service" "/etc/systemd/system/${backend_service}.service"
  ynh_replace_string --match_string="__APP__" --replace_string="$app" --target_file="/etc/systemd/system/${backend_service}.service"
  ynh_replace_string --match_string="__INSTALL_DIR__" --replace_string="$install_dir" --target_file="/etc/systemd/system/${backend_service}.service"
  ynh_replace_string --match_string="__ENV_FILE__" --replace_string="$env_file" --target_file="/etc/systemd/system/${backend_service}.service"
  ynh_replace_string --match_string="__LOG_DIR__" --replace_string="$log_dir" --target_file="/etc/systemd/system/${backend_service}.service"

  cp "../conf/ai.service" "/etc/systemd/system/${ai_service}.service"
  ynh_replace_string --match_string="__APP__" --replace_string="$app" --target_file="/etc/systemd/system/${ai_service}.service"
  ynh_replace_string --match_string="__INSTALL_DIR__" --replace_string="$install_dir" --target_file="/etc/systemd/system/${ai_service}.service"
  ynh_replace_string --match_string="__ENV_FILE__" --replace_string="$env_file" --target_file="/etc/systemd/system/${ai_service}.service"
  ynh_replace_string --match_string="__LOG_DIR__" --replace_string="$log_dir" --target_file="/etc/systemd/system/${ai_service}.service"
}

_pandora_install_nginx() {
  local domain="$1"
  local path_url="$2"
  local backend_port="$3"
  local ai_port="$4"
  local base_path="$path_url"
  local ai_path

  if [ "$path_url" = "/" ]; then
    ai_path="/ai/"
  else
    ai_path="${path_url}/ai/"
  fi

  local nginx_conf="/etc/nginx/conf.d/${domain}.d/${app}.conf"
  cp "../conf/nginx.conf" "$nginx_conf"
  ynh_replace_string --match_string="__BASE_PATH__" --replace_string="$base_path" --target_file="$nginx_conf"
  ynh_replace_string --match_string="__AI_PATH__" --replace_string="$ai_path" --target_file="$nginx_conf"
  ynh_replace_string --match_string="__BACKEND_PORT__" --replace_string="$backend_port" --target_file="$nginx_conf"
  ynh_replace_string --match_string="__AI_PORT__" --replace_string="$ai_port" --target_file="$nginx_conf"
  ynh_replace_string --match_string="__DOMAIN__" --replace_string="$domain" --target_file="$nginx_conf"
}

_pandora_remove_nginx() {
  local domain="$1"
  rm -f "/etc/nginx/conf.d/${domain}.d/${app}.conf"
}
