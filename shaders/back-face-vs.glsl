varying vec3 worldSpaceCoords;

vec3 toLocal(vec3 p) {
		return p + vec3(0.5);
}

void main(){
    //Set the world space coordinates of the back faces vertices as output.
    worldSpaceCoords = toLocal(position); //move it from [-0.5;0.5] to [0,1]
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}