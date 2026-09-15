import { defineTool } from '@deepseek-ai/dsh-tools';
import { startPipelineWatch } from './pipeline-watch.js';
import { cleanTool } from './index.js';
function renderObject(value) {
    return [
        {
            type: 'text',
            text: JSON.stringify(value, null, 2)
        }
    ];
}
export function registerGitLabTools(ctx, gitlab) {
    const register = (ctx.tools?.register ?? ctx.tool?.register)?.bind(ctx.tools ?? ctx.tool);
    if (!register) {
        ctx.log?.warn?.('[dsh-devops] ctx.tools not available, skipping GitLab tool registration');
        return;
    }
    register(cleanTool(defineTool({
        name: 'gitlab_mr_create',
        description: 'Create a GitLab merge request. Auto-starts pipeline monitoring unless watch_pipeline is false.',
        parameters: {
            project: {
                type: 'string',
                description: 'Project ID (optional, uses default)'
            },
            source_branch: {
                type: 'string',
                description: 'Source branch name',
                required: true
            },
            target_branch: {
                type: 'string',
                description: 'Target branch name',
                required: true
            },
            title: {
                type: 'string',
                description: 'MR title',
                required: true
            },
            description: {
                type: 'string',
                description: 'MR description (markdown)'
            },
            reviewers: {
                type: 'array',
                description: 'Reviewer usernames (optional)',
                items: {
                    type: 'string'
                }
            },
            watch_pipeline: {
                type: 'boolean',
                description: 'Auto-start pipeline watch (default: true)'
            }
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: true
            },
            render: (_args, value)=>renderObject(value)
        },
        async execute (args) {
            const project = args.project || undefined;
            const mr = await gitlab.createMR(project, args.source_branch, args.target_branch, args.title, args.description);
            let watchMsg = '';
            if (args.watch_pipeline !== false) {
                startPipelineWatch(ctx, gitlab, project, args.source_branch);
                watchMsg = `📡 Pipeline monitoring started for ${args.source_branch}`;
            }
            return {
                iid: mr.iid,
                title: mr.title,
                state: mr.state,
                web_url: mr.webUrl,
                watch: watchMsg
            };
        }
    })));
    register(cleanTool(defineTool({
        name: 'gitlab_mr_review',
        description: 'Review a GitLab merge request: approve, request changes, or add a comment.',
        parameters: {
            project: {
                type: 'string',
                description: 'Project ID (optional, uses default)'
            },
            mr_iid: {
                type: 'number',
                description: 'MR iid (the number after !)',
                required: true
            },
            action: {
                type: 'string',
                description: 'Review action',
                enum: [
                    'approve',
                    'request_changes',
                    'comment'
                ],
                required: true
            },
            comment: {
                type: 'string',
                description: 'Review comment'
            }
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: true
            },
            render: (_args, value)=>renderObject(value)
        },
        async execute (args) {
            const project = args.project || undefined;
            const mrIid = args.mr_iid;
            const action = args.action;
            const comment = args.comment;
            switch(action){
                case 'approve':
                    await gitlab.approveMR(project, mrIid);
                    return {
                        ok: true,
                        action: 'approved',
                        mr_iid: mrIid
                    };
                case 'request_changes':
                    await gitlab.requestChanges(project, mrIid, comment ?? '');
                    return {
                        ok: true,
                        action: 'changes_requested',
                        mr_iid: mrIid
                    };
                case 'comment':
                    await gitlab.commentMR(project, mrIid, comment ?? '');
                    return {
                        ok: true,
                        action: 'commented',
                        mr_iid: mrIid
                    };
                default:
                    throw new Error(`Unknown review action: ${action}`);
            }
        }
    })));
    register(cleanTool(defineTool({
        name: 'gitlab_mr_list',
        description: 'List merge requests for a project.',
        parameters: {
            project: {
                type: 'string',
                description: 'Project ID (optional, uses default)'
            },
            state: {
                type: 'string',
                description: 'MR state filter (informational, currently defaults to opened)',
                enum: [
                    'opened',
                    'closed',
                    'merged',
                    'all'
                ]
            }
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: true
            },
            render: (_args, value)=>renderObject(value)
        },
        async execute (args) {
            const project = args.project || undefined;
            const mrs = await gitlab.listMRs(project);
            return {
                count: mrs.length,
                merge_requests: mrs.map((mr)=>({
                        iid: mr.iid,
                        title: mr.title,
                        state: mr.state,
                        source_branch: mr.sourceBranch,
                        target_branch: mr.targetBranch,
                        web_url: mr.webUrl,
                        approvals: mr.approvals
                    }))
            };
        }
    })));
    register(cleanTool(defineTool({
        name: 'gitlab_tag_create',
        description: 'Create a git tag in a GitLab project.',
        parameters: {
            project: {
                type: 'string',
                description: 'Project ID (optional, uses default)'
            },
            name: {
                type: 'string',
                description: 'Tag name (e.g., v1.0.0)',
                required: true
            },
            ref: {
                type: 'string',
                description: 'Branch/commit to tag (defaults to default branch)'
            },
            message: {
                type: 'string',
                description: 'Annotated tag message'
            }
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: true
            },
            render: (_args, value)=>renderObject(value)
        },
        async execute (args) {
            const project = args.project || undefined;
            const tag = await gitlab.createTag(project, args.name, args.ref, args.message);
            return {
                name: tag.name,
                commit_id: tag.commitId,
                message: tag.message
            };
        }
    })));
    register(cleanTool(defineTool({
        name: 'gitlab_pipeline_status',
        description: 'Get the latest pipeline status for a branch.',
        parameters: {
            project: {
                type: 'string',
                description: 'Project ID (optional, uses default)'
            },
            ref: {
                type: 'string',
                description: 'Branch/tag to check (defaults to default branch)'
            }
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: true
            },
            render: (_args, value)=>renderObject(value)
        },
        async execute (args) {
            const project = args.project || undefined;
            const ref = args.ref;
            const pipeline = await gitlab.getLatestPipelineByRef(project, ref);
            if (!pipeline) {
                return {
                    status: 'none',
                    message: `No pipeline found for ref "${ref ?? 'default'}"`
                };
            }
            return {
                id: pipeline.id,
                status: pipeline.status,
                ref: pipeline.ref,
                sha: pipeline.sha,
                web_url: pipeline.webUrl,
                created_at: pipeline.createdAt,
                finished_at: pipeline.finishedAt
            };
        }
    })));
    register(cleanTool(defineTool({
        name: 'gitlab_pipeline_jobs',
        description: 'List all jobs in a pipeline.',
        parameters: {
            project: {
                type: 'string',
                description: 'Project ID (optional, uses default)'
            },
            pipeline_id: {
                type: 'number',
                description: 'Pipeline ID',
                required: true
            }
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: true
            },
            render: (_args, value)=>renderObject(value)
        },
        async execute (args) {
            const project = args.project || undefined;
            const jobs = await gitlab.listPipelineJobs(project, args.pipeline_id);
            return {
                pipeline_id: args.pipeline_id,
                count: jobs.length,
                jobs: jobs.map((j)=>({
                        id: j.id,
                        name: j.name,
                        stage: j.stage,
                        status: j.status,
                        duration_sec: j.duration
                    }))
            };
        }
    })));
    register(cleanTool(defineTool({
        name: 'gitlab_pipeline_watch',
        description: 'Start, stop, or check pipeline monitoring for a branch.',
        parameters: {
            project: {
                type: 'string',
                description: 'Project ID (optional, uses default)'
            },
            action: {
                type: 'string',
                description: 'Watch action',
                enum: [
                    'start',
                    'status'
                ],
                required: true
            },
            branch: {
                type: 'string',
                description: 'Branch to monitor',
                required: true
            }
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: true
            },
            render: (_args, value)=>renderObject(value)
        },
        async execute (args) {
            const project = args.project || undefined;
            const branch = args.branch;
            switch(args.action){
                case 'start':
                    startPipelineWatch(ctx, gitlab, project, branch);
                    return {
                        ok: true,
                        message: `📡 Watching pipeline for branch: ${branch}`
                    };
                case 'status':
                    return {
                        ok: true,
                        message: `⏳ Pipeline watch for ${branch} is active (polling every 30s)`
                    };
                default:
                    throw new Error(`Unknown watch action: ${args.action}`);
            }
        }
    })));
}
