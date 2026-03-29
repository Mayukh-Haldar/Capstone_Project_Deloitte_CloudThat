vault {
  address = "http://vault:8200"
}

auto_auth {
  method "approle" {
    mount_path = "auth/approle"

    config = {
      role_id_file_path = "/vault/approle/role-id"
      secret_id_file_path = "/vault/approle/secret-id"
      secret_id_response_wrapping_path = "auth/approle/role/eventzen-local/secret-id"
      remove_secret_id_file_after_reading = false
    }
  }

  sink "file" {
    config = {
      path = "/vault/rendered/.agent-token"
    }
  }
}

template {
  source      = "/vault/templates/eventzen.env.ctmpl"
  destination = "/vault/rendered/eventzen.env"
  perms       = "0400"
}