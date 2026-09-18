variable "bucket_name" {
  description = "Globally-unique S3 bucket name. Callers decide the real name — this module doesn't invent one."
  type        = string
}

variable "enable_versioning" {
  type    = bool
  default = false
}

variable "tags" {
  description = "Extra tags merged into every resource in this module."
  type        = map(string)
  default     = {}
}
