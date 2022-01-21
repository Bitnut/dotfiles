AGENT_ENV="$HOME/.ssh/agent_env"

function new_agent {
     echo "Initialising new SSH agent..."
     /usr/bin/ssh-agent | sed 's/^echo/#echo/' > "${AGENT_ENV}"
     echo succeeded
     chmod 600 "${AGENT_ENV}"
     . "${AGENT_ENV}" > /dev/null
     /usr/bin/ssh-add;
}

# Source SSH settings, if applicable

if [ -f "${AGENT_ENV}" ]; then
     . "${AGENT_ENV}" > /dev/null
     #ps ${SSH_AGENT_PID} doesn't work under cywgin
     ps -ef | grep ${SSH_AGENT_PID} | grep ssh-agent$ > /dev/null || {
         new_agent;
     }
else
     new_agent;
fi

if [ -f ~/.bashrc ]; then
    . ~/.bashrc
fi
