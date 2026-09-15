import { GitLabRouter } from './router.js';
export function registerGitLab(ctx, config) {
    const router = new GitLabRouter(config.baseUrl, config.projects, config.defaultProject);
    ctx.effect(()=>{
        return ()=>{};
    }, 'gitlab');
    const service = {
        listProjects: ()=>router.list(),
        createMR: (project, sourceBranch, targetBranch, title, description)=>router.resolve(project).createMR(sourceBranch, targetBranch, title, description),
        approveMR: (project, mrIid)=>router.resolve(project).approveMR(mrIid),
        requestChanges: (project, mrIid, comment)=>router.resolve(project).requestChanges(mrIid, comment),
        commentMR: (project, mrIid, body)=>router.resolve(project).commentMR(mrIid, body),
        listMRs: (project)=>router.resolve(project).listMRs(),
        createTag: (project, name, ref, message)=>router.resolve(project).createTag(name, ref, message),
        getPipeline: (project, pipelineId)=>router.resolve(project).getPipeline(pipelineId),
        getLatestPipelineByRef: (project, ref)=>router.resolve(project).getLatestPipelineByRef(ref),
        listPipelineJobs: (project, pipelineId)=>router.resolve(project).listPipelineJobs(pipelineId),
        getJobLog: (project, jobId)=>router.resolve(project).getJobLog(jobId)
    };
    return service;
}
