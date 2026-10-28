# 0003. Upload photos straight to S3, and keep records in DynamoDB

- Status: accepted
- Date: 2026-10-27

## Context

Room photos are up to 10 MB. The app stores the original, the staged version, a small record per staging, and three
daily usage counters (rule R4). Part 1 teaches EKS basics, so there should be no database server to run, and the
API pods should stay stateless so the HPA can add and remove them freely.

## Decision

- **Uploads:** the API returns a presigned **POST** policy, and the browser sends the file straight to S3. The
  policy pins the key, the content type and a size range of 1 byte to `MAX_UPLOAD_BYTES`, so S3 itself rejects
  other files. The API then reads the upload, cleans it (rule R3) and stores it under `originals/`.
- **Viewing:** photos are served with presigned GET URLs that expire after an hour; the bucket stays private.
- **Records:** one DynamoDB table with a single partition key `pk` (`staging#<id>`, `usage#<date>#…`), on-demand
  billing, and TTL on the usage counters.
- **Daily limits:** one DynamoDB transaction updates the visitor, IP and site counters together, each with a
  condition `count < limit`. Either all three counters go up or none do, and the cancellation reasons say which
  limit was hit. Visitor ids and IPs are stored hashed.
- **Locally:** moto's server emulates S3 and DynamoDB in one container (host port 4566; macOS uses 5000 for
  AirPlay). The same boto3 code runs against it, with `S3_ENDPOINT_URL` and `DYNAMODB_ENDPOINT_URL` pointing there.
  Presigned URLs are signed for `S3_PUBLIC_ENDPOINT_URL`, the address the browser uses.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Presigned POST to S3 (chosen) | API pods never carry 10 MB bodies; S3 enforces size and type | Two steps for the client |
| Presigned PUT | Simpler URL | Can't enforce a size range |
| Upload through the API | One request | Large bodies through the ALB and pods; slower scaling |
| DynamoDB (chosen) | Nothing to run; transactions for the limits; Pod Identity for access | Single-table design is new to some students |
| PostgreSQL on RDS | Familiar SQL | A server to run and pay for; arrives in part 2 where it fits |

## Consequences

- API pods hold no state, so any pod can serve any request.
- In AWS: the bucket needs CORS for the web origin, Block Public Access, and a lifecycle rule for `uploads/`; the
  table needs TTL on `expires_at`. All of it lives in Terraform (phase 1).
- moto keeps everything in memory, so local data disappears when the container stops.
