# Changelog

All notable changes to this project are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.1.0]
### Added
- Read-only MCP server for Moodle with 9 tools: `get_site_info`, `list_courses`, `get_course_contents`,
  `list_assignments`, `get_assignment_status`, `get_upcoming_deadlines`, `get_grades`,
  `list_forum_discussions`, `get_notifications`.
- Streamable HTTP transport (stateless) with bearer-token or URL-secret auth, plus stdio.
- Runs on Node (Docker) and Cloudflare Workers.
- `get_upcoming_deadlines` includes already-submitted assignments with their status.
- Fixture-based tests, CI.
