resource "aws_s3_bucket" "code_metrics" {
  bucket = "ttp-code-metrics-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "code_metrics" {
  bucket = aws_s3_bucket.code_metrics.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
