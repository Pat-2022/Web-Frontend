import { BACKEND_PORT } from './config.js';
// A helper you may want to use when uploading new images to the server.
import { fileToDataUrl } from './helpers.js';

let token = null;
let userId = null;
let channelIdCurrent = null;
let msgs_flags = {};

//Trigger an error popup
const errorPopup = (message) => {
    document.getElementById("ptag").innerText = message;
    $('#myModal').modal('show');
}

//a function that checks whether an object has a certain key
const isKeyInObject = (object, key) => {
    return Object.keys(object).some(v => v == key);
}


//make request to the server
const makeRequest = (route, method, body) => {
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        }
    };

    if (body !== undefined) {
        options.body = JSON.stringify(body);
    }
    
    return new Promise((resolve, reject) => {
        fetch(`http://localhost:${BACKEND_PORT}`+ route, options)
            .then(rawresponse => {
                return rawresponse.json();
            }).then(data => {
                if (data.error) {
                    //alert(data.error);
                    reject(data.error);
                    // errorPopup(data.error);
                } else {
                    resolve(data);
                }
            });
    });
};


//Upon clicking the register button, make a request to the server to register the user
document.getElementById('register-action').addEventListener('click', () => {
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    //check if the password and confirm password are the same
    if (password !== confirmPassword) {
        //alert('Passwords do not match');
        errorPopup('Passwords do not match');
        return;
    };

    const name = document.getElementById('register-name').value;
    const body = { 
        "email": email,
        "password": password,
        "name": name};

    makeRequest('/auth/register', 'POST', body)
    .then(data => {
        token = data.token;
        userId = data.userId;
        login();
    })
    .catch(error => {
        errorPopup(error);
    });
});


//Upon clicking the login button, make a request to the server to login the user
document.getElementById('login-action').addEventListener('click', () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const body = { 
        "email": email,
        "password": password};

    makeRequest('/auth/login', 'POST', body)
    .then(data => {
        token = data.token;
        userId = data.userId;
        login();
    })
    .catch(error => {
        errorPopup(error);
    });

});

//a function that determines whether the message is a white space
const onlySpaces= (str) => {
    return /^\s*$/.test(str);
}

//Upon clicking the msgsend button, make a request to the server to send the message
document.getElementById('msgsend-action').addEventListener('click', () => {
    const message = document.getElementById('msgsend-text').value;

    if ( onlySpaces(message) ) {
        errorPopup('Message cannot be empty');
        return;
    }

    const body = { 
        "message": message
    };

    makeRequest('/message/'+channelIdCurrent, 'POST', body)
    .then(data => {
        displayChannel(channelIdCurrent);
    })
    .catch(error => {
        errorPopup(error);
    });
    document.getElementById('msgsend-text').value='';
});


//Upon clicking the create-form button, make a request to the server to create a new channel
document.getElementById('create-form').addEventListener('click', () => {
    const channel_name = form["channel_name"].value;
    const channel_description = form["channel_description"].value;
    const channel_type = form["channel_type"].value;

    //make sure the channel has a name
    if (channel_name === "") {
        errorPopup("Channel name cannot be empty");
        return;
    }

    let private_bool = false;
    if (channel_type === 'Public') {
        private_bool = false;
    } else {
        private_bool = true;
    }

    const body = { 
        "name": channel_name,
        "private": private_bool,
        "description": channel_description,
    };

    makeRequest('/channel', 'POST', body)
    .then(data => {
       displayChannels();
    })
    .catch(error => {
        errorPopup(error);
    });
});


//Upon clicking the logout button, make a request to the server to logout the user
document.getElementById('logout-action').addEventListener('click', () => {
    makeRequest('/auth/logout', 'POST', {})
    .then(data => {
        logout();
    })
    .catch(error => {
        errorPopup(error);
    });
});

//get the info section of a channel
const displayChannel_get_info = (channelId) => {
    makeRequest('/channel/'+channelId, 'GET', undefined)
    .then(data => {
        const members = data.members;
        const channel_name = data.name;
        const channel_description = data.description;
        //initiate the state
        document.getElementById("change-channel-info-action").disabled = false;
        document.getElementById('channel-messages').classList.remove('hide');
        document.getElementById('join-channel-action').classList.add('hide');
        document.getElementById('leave-channel-action').classList.remove('hide');
        //get the channel type
        let channel_type = "Public";
        if (data.private) {
            channel_type = "Private";
        }
        //get the channel created time
        const t = new Date(data.createdAt);
        const dateStr = t.toISOString().split('T')[0];
        const timeStr = t.toTimeString().split(' ')[0];
        const channel_timestamp = dateStr + ' ' + timeStr;
        //get the channel creator
        const channel_creator = data.creator;
        //display the channel info
        document.getElementById('channel-name').value=channel_name;
        document.getElementById('channel-description').value=channel_description;
        document.getElementById('channel-type').innerText = channel_type;
        document.getElementById('channel-timestamp').innerText = channel_timestamp;
        document.getElementById('channel-creator').innerText = channel_creator;
    })
    //if the user is not a member of the channel
    .catch(() =>{
        document.getElementById("change-channel-info-action").disabled = true;
        document.getElementById('channel-messages').classList.add('hide');
        document.getElementById('join-channel-action').classList.remove('hide');
        document.getElementById('leave-channel-action').classList.add('hide');
    });
};

//a function that gets the messages in the channel
const displayChannel_get_msgs = (channelId) => {
    makeRequest('/message/' + channelId + '?start=0', 'GET', undefined)
    .then(data => {
        for (const messageObj of data.messages) {
            const messageDiv = document.createElement('div');
            messageDiv.id='message-div'+messageObj.id;

            const senderMessageDiv = document.createElement('div');
            senderMessageDiv.id = 'sender-message'+messageObj.id;

            const senderInfoDiv = document.createElement('div');
            senderInfoDiv.id='sender-info'+messageObj.id;

            const senderNameSpan = document.createElement('span');
            senderNameSpan.id='sender-name'+messageObj.id;

            const senderPhotoImg = document.createElement('img');
            senderPhotoImg.id='sender-photo'+messageObj.id;

            const senderTimestampSpan = document.createElement('span');
            senderTimestampSpan.id='sender-timestamp'+messageObj.id;

            senderMessageDiv.innerText = messageObj.message;
            senderNameSpan.innerText = messageObj.sender;

            //get date and time
            let t = '';
            if (messageObj.editedAt) {
                t = new Date(messageObj.editedAt);
            } else {
                t = new Date(messageObj.sentAt);
            }

            const dateStr = t.toISOString().split('T')[0];
            const timeStr = t.toTimeString().split(' ')[0];
            senderTimestampSpan.innerText = dateStr + ' ' + timeStr;

            if (isKeyInObject(messageObj, 'image')) {
                senderPhotoImg.src = messageObj.image;
            } else {
                senderPhotoImg.src = 'https://www.w3schools.com/howto/img_avatar.png';
            }

            document.getElementById('channel-messages-body').appendChild(messageDiv);
            document.getElementById('message-div'+messageObj.id).appendChild(senderMessageDiv);


            const messageEmojiDiv = document.createElement('div');
            messageEmojiDiv.id = 'message-emoji-div'+messageObj.id;
            const messageEmojiLike = document.createElement('button');
            messageEmojiLike.id = 'message-emoji-like'+messageObj.id;
            messageEmojiLike.className = 'emoji-button';
            messageEmojiLike.innerText = '👍';
            const messageEmojiSmile = document.createElement('button');
            messageEmojiSmile.id = 'message-emoji-smile'+messageObj.id;
            messageEmojiSmile.className = 'emoji-button';
            messageEmojiSmile.innerText = '😄';
            const messageEmojiAngry = document.createElement('button');
            messageEmojiAngry.id = 'message-emoji-angry'+messageObj.id;
            messageEmojiAngry.className = 'emoji-button';
            messageEmojiAngry.innerText = '😡';
            document.getElementById('message-div'+messageObj.id).appendChild(messageEmojiDiv);
            document.getElementById('message-emoji-div'+messageObj.id).appendChild(messageEmojiLike);
            document.getElementById('message-emoji-div'+messageObj.id).appendChild(messageEmojiSmile);
            document.getElementById('message-emoji-div'+messageObj.id).appendChild(messageEmojiAngry);


            //an object(dictionary) that stores the flags of the emojis for each message
            msgs_flags[messageObj.id] = {'smile':false,
                                        'like':false,
                                        'angry':false
                                        };
            
            //display the emojis for each message                            
            for (const reactObj of messageObj.reacts) {
                if (reactObj.react === 'like') {
                    document.getElementById('message-emoji-like'+messageObj.id).classList.add('emoji_check');
                    msgs_flags[messageObj.id]['like'] = true;
                } else if (reactObj.react === 'smile') {
                    document.getElementById('message-emoji-smile'+messageObj.id).classList.add('emoji_check');
                    msgs_flags[messageObj.id]['smile'] = true;
                } else if (reactObj.react === 'angry') {
                    document.getElementById('message-emoji-angry'+messageObj.id).classList.add('emoji_check');
                    msgs_flags[messageObj.id]['angry'] = true;
                } 
            }

            //add click listeners to the emoji
            const emoji_EventListener = (emoji) => {
                const emoji_id = `message-emoji-${emoji}`+messageObj.id;
                const body={
                    "react": emoji
                }
                document.querySelector(`#${emoji_id}`).addEventListener('click', () => {
                    if(msgs_flags[messageObj.id][emoji]){
                        makeRequest('/message/unreact/'+`${channelIdCurrent}/${messageObj.id}`, 'POST', body)
                        .then(data => {
                            document.querySelector(`#${emoji_id}`).classList.remove('emoji_check');
                            msgs_flags[messageObj.id][emoji] =false;
                        })
                        .catch(err => {
                            errorPopup(err);
                        })
                    }else{
                        makeRequest('/message/react/'+`${channelIdCurrent}/${messageObj.id}`, 'POST', body)
                        .then(data => {
                            document.querySelector(`#${emoji_id}`).classList.add('emoji_check');
                            msgs_flags[messageObj.id][emoji] =true;
                        })
                        .catch(err => {
                            errorPopup(err);
                        })
                    }
                });
            }

            emoji_EventListener('like');
            emoji_EventListener('smile');
            emoji_EventListener('angry');
            

            document.getElementById('message-div'+messageObj.id).appendChild(senderInfoDiv);
            document.getElementById('sender-info'+messageObj.id).appendChild(senderNameSpan);
            document.getElementById('sender-info'+messageObj.id).appendChild(senderPhotoImg);
            document.getElementById('sender-info'+messageObj.id).appendChild(senderTimestampSpan);

            if (messageObj.sender === userId) {
                const deleteMessageButton = document.createElement('button');
                deleteMessageButton.classList.add('delete-message-button');
                deleteMessageButton.innerText = 'Delete';
                document.getElementById('sender-info'+messageObj.id).appendChild(deleteMessageButton);

                //delete message
                deleteMessageButton.onclick = () => {
                    makeRequest('/message/'+channelId+'/'+ messageObj.id, 'DELETE', undefined)
                    .then(() => {
                        displayChannel(channelId);
                    })
                    .catch((error) => {
                        errorPopup(error);
                    });
                };

                const editMessageButton = document.createElement('button');
                editMessageButton.id='edit-message-button'+messageObj.id;
                editMessageButton.innerText = 'Edit';
                document.getElementById('sender-info'+messageObj.id).appendChild(editMessageButton);
                
                const editMessageConfirmButton = document.createElement('button');
                editMessageConfirmButton.id='edit-message-confirm-button'+messageObj.id;
                editMessageConfirmButton.innerText = 'Confirm editing';
                editMessageConfirmButton.classList.add('hide');
                document.getElementById('sender-info'+messageObj.id).appendChild(editMessageConfirmButton);

                //Upon clicking the edit message button, show the edit message state
                editMessageButton.onclick = () => {
                    document.getElementById('sender-message'+messageObj.id).style.backgroundColor = "white";
                    document.getElementById('sender-message'+messageObj.id).contentEditable = true;
                    document.getElementById('edit-message-confirm-button'+messageObj.id).classList.remove('hide');

                }

                //Upon clicking the confirm editing button, send the edited message to the server
                editMessageConfirmButton.onclick = () => {
                    const message =document.getElementById('sender-message'+messageObj.id).innerText;
                    if (message===messageObj.message){
                        errorPopup('Cannot edit a message to the same existing message');
                        return;
                    } 

                    const image = document.getElementById('sender-photo'+messageObj.id).src;
                    const body = { 
                        "message": message,
                        "image": image
                    };
                    makeRequest('/message/'+channelId+'/'+ messageObj.id, 'PUT', body)
                    .then(() => {
                        document.getElementById('sender-message'+messageObj.id).style.backgroundColor = null;
                        document.getElementById('sender-message'+messageObj.id).contentEditable = false;
                        document.getElementById('edit-message-confirm-button'+messageObj.id).classList.add('hide');
                        displayChannel(channelId);
                    })
                    .catch((error) => {
                        errorPopup(error);
                    });
                }
            }

            document.getElementById('channel-messages-body').appendChild(document.createElement('hr'));
        };
    })
    .catch(error => {
        console.error(error);
    });
};

//display a certain channel
const displayChannel = (channelId) => {
    channelIdCurrent = channelId;
    document.getElementById('Current-channel-section').classList.remove('hide');
    //upadte channel name, description, type, timestamp and creator
    document.getElementById('channel-name').value=null;
    document.getElementById('channel-description').value=null;
    document.getElementById('channel-type').innerText = '';
    document.getElementById('channel-timestamp').innerText = '';
    document.getElementById('channel-creator').innerText = '';
    //update the channel's messages
    document.getElementById('channel-messages-body').remove();
    const newchannel_messages_body = document.createElement('div');
    newchannel_messages_body.id = 'channel-messages-body';
    document.getElementById('channel-messages').appendChild(newchannel_messages_body);
    const msg_header=document.createElement('p');
    msg_header.innerText ='Channel Messages';
    msg_header.style.fontWeight='bold';
    msg_header.style.fontSize='20px';
    document.getElementById('channel-messages-body').appendChild(msg_header);
    document.getElementById('channel-messages-body').appendChild(document.createElement('hr'));
    //get the info section of the channel
    displayChannel_get_info(channelId);
    
    //get the messages in the channel
    displayChannel_get_msgs(channelId);
};


//display channels that the user is in
const displayChannels = () => {

    //update the public channels
    document.getElementById('public-channels-body').remove();
    const newpublic_channels_body = document.createElement('div');
    newpublic_channels_body.id = 'public-channels-body';
    document.getElementById('public-channels-list').appendChild(newpublic_channels_body);

    //update the private channels
    document.getElementById('private-channels-body').remove();
    const newprivate_channels_body = document.createElement('div');
    newprivate_channels_body.id = 'private-channels-body';
    document.getElementById('private-channels-list').appendChild(newprivate_channels_body);

    makeRequest('/channel', 'GET', undefined)
    .then(data => {
        for (const channel of data.channels) {
            //display all the channels
            const link = document.createElement('a');
            link.innerText = channel.name;
            if (channel.private === true) {
                document.getElementById('private-channels-body').appendChild(link);
            } else {
                document.getElementById('public-channels-body').appendChild(link);
            }
            link.addEventListener('click', () => {
                displayChannel(channel.id);
            });


        };
    })
    .catch(error => {
        errorPopup(error);
    });
}; 

//when logout, change the page's structure to the logged-out page
const logout = () => {
    document.getElementById('logged-in').classList.add('hide');
    document.getElementById('logged-out').classList.remove('hide');
    token = null;
    userId = null;
};

//when login, change the page's structure to the logged-in page
const login = () => {
    document.getElementById('logged-out').classList.add('hide');
    document.getElementById('logged-in').classList.remove('hide');
    displayChannels();
};

//switch to the login page by clicking the blue login button
document.getElementById('nav-login').addEventListener('click', () => {
    document.getElementById('register').classList.add('hide');
    document.getElementById('login').classList.remove('hide');
});

//switch to the register page by clicking the blue register button
document.getElementById('nav-register').addEventListener('click', () => {
    document.getElementById('login').classList.add('hide');
    document.getElementById('register').classList.remove('hide');
});


//click the create-channel button to show a form
document.getElementById('create-channel').addEventListener('click', () => {
    document.getElementById('channel-form').classList.remove('hide');
    document.getElementById('create-form').classList.remove('hide');
});

//click the close-channel-form button to hide the form
document.getElementById('close-channel-form').addEventListener('click', () => {
    document.getElementById('channel-form').classList.add('hide');
    document.getElementById('create-form').classList.add('hide');
});


//click the change-channel-info button to change the channel's info
document.getElementById('change-channel-info-action').addEventListener('click', () => {

    const channel_name = document.getElementById('channel-name').value;
    const channel_description = document.getElementById('channel-description').value;
    const body = { 
        "name": channel_name,
        "description": channel_description
    };

    makeRequest('/channel/'+channelIdCurrent, 'PUT', body)
    .then(data => {
       displayChannels();
       displayChannel(channelIdCurrent);
    })
    .catch(error => {
        errorPopup(error);
    });
});

//click the join-channel-action button to join the channel
document.getElementById('join-channel-action').addEventListener('click', () => {
    makeRequest('/channel/'+channelIdCurrent+'/join', 'POST', undefined)
    .then(data => {
        displayChannel(channelIdCurrent);
    })
    .catch(error => {
        errorPopup(error);
    });
});

//click the leave-channel-action button to leave the channel
document.getElementById('leave-channel-action').addEventListener('click', () => {
    makeRequest('/channel/'+channelIdCurrent+'/leave', 'POST', undefined)
    .then(data => {
        displayChannel(channelIdCurrent);
    })
    .catch(error => {
        errorPopup(error);
    });
});

