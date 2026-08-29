import { idSchema } from "@procurement/contracts";
import { createFileRoute } from "@tanstack/react-router";
import { AuthoritativeWorkspace } from "../features/workspace/AuthoritativeWorkspace";

type WorkspaceSearch = Readonly<{ workspace?: string }>;

function WorkspaceRoute() {
  const { workspace } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <AuthoritativeWorkspace
      workspaceId={workspace}
      onWorkspaceChange={(workspaceId) =>
        void navigate({
          search: workspaceId ? { workspace: workspaceId } : {},
          replace: true,
        })
      }
    />
  );
}

export const Route = createFileRoute("/")({
  validateSearch: (search): WorkspaceSearch => {
    const workspace = idSchema.safeParse(search.workspace);
    return workspace.success ? { workspace: workspace.data } : {};
  },
  component: WorkspaceRoute,
});
