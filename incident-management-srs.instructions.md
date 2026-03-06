# Incident Management SRS Skill

This agent-customization file captures the user-level Software Requirements Specification (SRS) for the Incident Management Web Application. It is intended to help the Copilot agent remind itself of core requirements when assisting with development tasks.

Each section below mirrors the structure of the original SRS (`SRS.md`).  When working on code or documentation within this repository, the agent should consult this file for requirements and user expectations.

## Requirements Summary

- **Actors:** Incident Creators and Issue Responders (site engineers).
- **Authentication:** Email/password registration and login; role-based access control.
- **Creators can:**
  - Register, log in, create issues with title and description.
  - View a dashboard of their own issues.
  - Comment on their issues.
  - Change issue status (`Open` ↔ `In-Process` ↔ `Closed`) within defined rules.
- **Responders can:**
  - Log in and see issues assigned to them.
  - Add comments/responses to assigned issues.
  - Update status (`Open` → `In-Process` → `Closed`).
- **Data:** Each issue has creator, responder, status, timestamps, comments; only visible to permitted users.

## Non-functional

- Support 100+ concurrent users.
- Page load <2s.
- Secure password storage, HTTPS, auditing.
- Responsive design.

## Use-cases and Functional Requirements

Refer to `SRS.md` for detailed numbered FRs (FR-1 through FR-15) and UI expectations.

## How to use this skill

When asked to implement features, write tests, or design data models for this project, reference this document to ensure the solution matches the user requirements listed.

> **Note:** This file is purely informational.  It should not be used as executable code but rather as a guideline for the assistant during development tasks.