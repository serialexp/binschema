variable "VERSION" {
  default = "dev"
}

group "default" {
  targets = ["website"]
}

target "website" {
  context = "."
  dockerfile = "website/Dockerfile"
  platforms = ["linux/amd64", "linux/arm64"]
  tags = ["aeolun/binschema-website:latest", "aeolun/binschema-website:${VERSION}"]
}
