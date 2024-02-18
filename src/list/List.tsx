import { Card, Fade, Grid, Stack, Typography } from '@mui/material';
import React from 'react';

type Project = {
    title: string;
    description: string;
};

type Props = {
    projects: Project[];
    onClickProject: (i: number) => void;
};

type ProjectCardProps = Project & { index: number, onClick: (i: number) => void };

const ProjectCard: React.FC<ProjectCardProps> = ({ title, description, index, onClick }) => {
    return <Fade in={true} timeout={1000} style={{
        transitionDelay: `${(index + 1) * 100}ms`,
    }}>
        <Card sx={{
            margin: 2,
            padding: 2,
            borderRadius: "10px",
            border: "2px solid white",
            boxShadow: "0px 0px 10px 0px white",
            cursor: "pointer",
            height: "20vh",
            "&:hover": {
                transition: "all 0.2s ease-in-out !important",
                boxShadow: "0px 0px 20px 0px red !important",
                border: "2px solid red",
            },
        }}
            onClick={() => { onClick(index) }}
        >
            <Typography variant="h5">{title}</Typography>
            <Typography >{description}</Typography>
        </Card>
    </Fade>
}

const List: React.FC<Props> = ({ projects, onClickProject }) => {
    return <Stack direction="column" sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
    }}>
        <Typography variant="h3">Please, pick a project...</Typography>
        <Grid container direction={"row"} sx={{
            width: "70%",
            minWidth: "600px",
            gridAutoRows: "auto",
        }}>
            {projects.map((project, i) => (
                <Grid item xs={4} key={project.title}>
                    <ProjectCard key={project.title} index={i} onClick={onClickProject} {...project} />
                </Grid>

            ))}
        </Grid>
    </Stack>
};

export default List;
export type { Project };