# EventZen ECS Deployment Assets

This directory contains the production deployment assets for moving EventZen from the current EC2 + Docker Compose flow to AWS ECS with AWS Secrets Manager.

Contents:

- `secrets-manager-mapping.md`: service-by-service mapping of runtime configuration, what should live in AWS Secrets Manager, and what can stay as plain ECS environment variables.
- `ecs-structure-migration-guide.md`: repo-level guide for changing the current Docker Compose-oriented structure into the ALB + ECS shape used in the deployment plan.
- `compose-to-ecs-mapping-guide.md`: detailed mapping of each Compose service, dependency, route, and environment assumption to its ECS or managed AWS replacement.
- `repo-migration-checklist.md`: repo-specific migration checklist for converting the current Compose production assumptions into the final ECS deployment shape.
- `service-creation-mapping.md`: exact ECS service creation mapping for the seven deployable application services.
- `target-group-mapping.md`: exact ALB target group and route ownership mapping for ECS production.
- `keep-remove-for-ecs.md`: exact keep/remove decision list for what belongs in the ECS app plane.
- `task-definitions/`: ECS task definition templates for the frontend and each backend service.

Suggested rollout order:

1. Create AWS infrastructure: VPC, ECS cluster, ALB, CloudWatch log groups, ECR repositories, IAM roles.
2. Create the Secrets Manager secrets described in `secrets-manager-mapping.md`.
3. Copy the relevant task definition template from `task-definitions/` and replace placeholder values with your real AWS ARNs, managed service endpoints, internal service discovery URLs, and log groups.
4. Create ECS services and target groups that match the ALB path routing documented in `nginx/nginx.generated.conf` and summarized in `repo-migration-checklist.md`.
5. Configure the GitHub Actions workflows in `.github/workflows/` to build, push, and deploy each service.

Notes:

- Backend secrets should come from AWS Secrets Manager through ECS task definition `secrets` entries.
- Frontend values are public browser configuration and should be supplied through build args or runtime config, not hidden secrets.
- The current frontend still reads `VITE_*` variables at build time, so frontend deployment will keep using public build-time configuration until runtime config injection is implemented.
- Internal service-to-service URLs in task definitions are deployment-time placeholders and should be filled with ECS Service Connect or Cloud Map names, not Docker Compose hostnames.
