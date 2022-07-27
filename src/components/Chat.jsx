import "./Chat.scss";
import { faUser, faComments as comments, faCheck as check } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from "react";
import { Client } from '@twilio/conversations';

export default function Chat() {
    const queueList = [{
        id: 1,
        name: 'Twilio/Text Chat',
        desc: 'Billing related queries',
        isActive: true,
        embedKey:"QA1-PROD-1157-64551278b0d8e191ec35d636df2d7d2b72d87b3f"
    },
    {
        id: 2,
        name: 'Core Chat',
        desc: 'General',
        isActive: false,
        embedKey:"QA1-PROD-1157-64551278b0d8e191ec35d636df2d7d2b72d87b3f"
    }, {
        id: 3,
        name: 'Core Chat #1',
        desc: 'Sales/marketing',
        isActive: false,
        embedKey:"QA1-PROD-1157-64551278b0d8e191ec35d636df2d7d2b72d87b3f"
    }, {
        id: 4,
        name: 'Mig #1',
        desc: 'Insurance related queries',
        isActive: false,
        embedKey:"QA1-PROD-1157-64551278b0d8e191ec35d636df2d7d2b72d87b3f"
    }]
    const [queues,setQueues] = useState(queueList)
    const onQueueChangeHandler = (id) => {
        
        var updated = queues.map(q => q);
        updated.map(queue => {
            queue.isActive = false;
            return queue;
        })
        .filter(queue => queue.id === id)
        .forEach(queue => queue.isActive = true);
        setQueues(updated);
        // if (true) {
        //     //var url = (env == 'stage') ? ('https://tm' + pod + '.q-centralstage.com') : ('https://tm' + pod + '.q-central.' + env);
        //     //url += '/content/sdk/' + version + '/js/Onvida-Common.js';
        //     var url = "https://tm.q-central.com/content/sdk/latest/js/Onvida-Common.js";
        //     var elem = document.createElement('script');
        //     //elem.onload = initChat;
        //     elem.type = 'text/javascript';
        //     elem.crossOrigin = 'anonymous';
        //     elem.src = url;
        //     var elemParent = document.head;
        //     elemParent.insertAdjacentElement('beforeend', elem);
        // }
    }
    return (
        <div className="chat">
            <div className="left-pane">
                <div class="list-group">
                    {
                        queues.map(queue => {
                            return (
                                <a href="#" onClick={() => {
                                    onQueueChangeHandler(queue.id)
                                }} key={queue.id} className={`list-group-item list-group-item-action flex-column align-items-start ${queue.isActive ? 'active' : ''}`}>
                                    <div class="d-flex w-100 justify-content-between">
                                        <h5 class="mb-1">{queue.name}</h5>
                                        <span className="icon">
                                            <FontAwesomeIcon icon={comments} inverse />
                                        </span>
                                    </div>
                                    <small>{queue.desc}</small>
                                </a>
                            )
                        })
                    }
                </div>
            </div>
            <div className="right-pane onv-chat-console">
                    <div className="onvida" >

                    </div>
            </div>
        </div>
    )
}